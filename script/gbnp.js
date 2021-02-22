const CARTRIDGE_TYPES = [
  'None',
  'MBC1', 'MBC1', 'MBC1', null,
  'MBC2', 'MBC2', null,
  'None', 'None', null, null, null, null, null,
  'MBC3', 'MBC3', 'MBC3', 'MBC3', 'MBC3', null, null, null, null, null,
  'MBC5', 'MBC5', 'MBC5', 'MBC5', 'MBC5', 'MBC5'
];
const MAP_TRAILER_BYTES = [0x02, 0x00, 0x30, 0x12, 0x99, 0x11, 0x12, 0x20, 0x37, 0x57, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00];
const BITMAP_PREVIEW_BYTES = [
  [0xFF, 0xFF, 0xFF, 0xFF], // white
  [0xBB, 0xBB, 0xBB, 0xFF], // light grey
  [0x66, 0x66, 0x66, 0xFF], // dark grey
  [0x00, 0x00, 0x00, 0xFF] // black
];
const FONTS = [
  { style: 'normal 8px Gameboy', y: 7 },
  { style: 'normal 8px PokemonGB', y: 7 },
  { style: 'normal 8px Nokia', y: 7 },
  { style: 'normal 16px Gamer', y: 7 },
  { style: 'normal 5px PICO-8', y: 7 },
];
const MENU_TITLE_CHECK = 'NP M-MENU';

class Menu {
  constructor() {
    this.data = null;
    const menuData = localStorage.getItem('menuData');
    if (menuData) {
      this.data = JSON.parse(menuData).data;
      console.log("Menu data loaded from storage")
    } else {
      this.loadMenuDataFromScript();
    }
  }

  present() {
    return !!this.data
  }

  setData(arrayBuffer) {
    this.data = new Uint8Array(arrayBuffer);
    localStorage.setItem('menuData', JSON.stringify({ data: Array.from(this.data) }));
    console.log("Menu data loaded from script")
  }

  loadMenuDataFromScript() {
    const head = document.getElementsByTagName('head')[0];
    const menuScript = document.createElement('script');
    menuScript.src = 'script/menu.js';

    head.appendChild(menuScript);
  }
}

class ROM {
  constructor(arrayBuffer, fontIndex) {
    let file = new FileSeeker(arrayBuffer);

    file.seek(0x134);
    this.title = String.fromCharCode(...file.read(0xF)).replace(/\0/g, '');
    this.menuText = this.title;

    file.seek(0x143);
    let cgbByte = file.readByte();
    this.cgb = cgbByte == 0x80 || cgbByte == 0xC0;

    file.seek(0x147);
    this.typeByte = file.readByte();
    this.type = CARTRIDGE_TYPES[this.typeByte];
    this.romByte = file.readByte();
    this.ramByte = file.readByte();

    this.updateBitmap(fontIndex);

    file.rewind();
    this.arrayBuffer = new ArrayBuffer(this.paddedRomSizeKB() * 1024);
    let paddedFile = new FileSeeker(this.arrayBuffer);

    if (file.size() > this.arrayBuffer.byteLength) {
      if (!this.isMenu()) {
        alert(`Error with ${this.title}!\nROM header size is smaller than the file size!`);
      }
      this.bad = true;
      return;
    } else {
      paddedFile.writeBytes(file.read(file.size()));
    }

    if (!this.valid()) { alert('File is not a valid Game Boy ROM!'); this.bad = true; }
    else if (!this.type) { alert(`Error with ${this.title}!\nCartridge type could not be determined!`); this.bad = true; }
    else if (this.ramSizeKB() > 32) { alert(`Error with ${this.title}!\nGame requires more than 32 KB of RAM!`); this.bad = true; }
  }

  valid() {
    if (!this._valid) {
      let check = Array.from(new Uint8Array(this.arrayBuffer.slice(260, 265)));
      this._valid = (JSON.stringify(check) === JSON.stringify([0xCE,0xED,0x66, 0x66, 0xCC]));
    }

    return this._valid;
  }

  romSizeKB() {
    return 32 << this.romByte;
  }

  paddedRomSizeKB() {
    return this.padded() ? 128 : this.romSizeKB();
  }

  padded() {
    return this.romSizeKB() < 128;
  }

  ramSizeKB() {
    return Math.trunc(Math.pow(4, this.ramByte - 1)) * 2;
  }

  paddedRamSizeKB() {
    if (this.typeByte === 0x06) { return 8; }
    return this.ramSizeKB();
  }

  isMenu() {
    return this.title.includes(MENU_TITLE_CHECK);
  }

  updateMenuText(text, fontIndex) {
    this.menuText = text;
    this.updateBitmap(fontIndex);
  }

  updateBitmap(fontIndex) {
    let buffer = [];

    const canvas = document.createElement("canvas");
    canvas.height = 8;
    canvas.width = 128;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 128, 8);
    const font = FONTS[fontIndex || 0];
    ctx.font = font.style;
    ctx.fillStyle = 'black';

    let text = this.menuText;
    if (fontIndex == 3) {
      text = text.toUpperCase();
    }
    ctx.fillText(text,1,font.y);
    ctx.fillStyle = 'white';
    ctx.fillRect(127, 0, 127, 8);

    const imageData = ctx.getImageData(0, 0, 128, 8).data;

    for (let i = 0; i < imageData.length; i+=16){
      let byte = 0;
      for (let j = 0; j < 4; j++) {
        let red = imageData[i+j*4];
        if (red < 127) {
          byte = byte | 0b11 << (6 - j*2);
        }
      }
      buffer.push(byte)
    }

    let outputBuffer = []
    for (let h = 0; h < 32; h+=2) {
      for (let i = h; i < 256; i+=32) {
        let a = buffer[i]
        let b = buffer[i+1]

        let outputA =
          (a & 0b10000000) | ((a & 0b00100000) << 1) | ((a & 0b00001000) << 2) | ((a & 0b00000010) << 3) |
          ((b & 0b10000000) >> 4) | ((b & 0b00100000) >> 3) | ((b & 0b00001000) >> 2) | ((b & 0b00000010) >> 1);
        let outputB =
          ((a & 0b01000000) << 1) | ((a & 0b00010000) << 2) | ((a & 0b00000100) << 3) | ((a & 0b00000001) << 4) |
          ((b & 0b01000000) >> 3) | ((b & 0b00010000) >> 2) | ((b & 0b00000100) >> 1) | (b & 0b00000001);

        outputBuffer.push(outputA, outputB);
      }
    }

    this.bitmapBuffer = new Uint8Array(outputBuffer);
    this.updateBitmapPreview(buffer);
  }

  updateBitmapPreview(buffer) {
    let previewBuffer = []

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      let bits = [
        (byte & 0b11000000) >> 6,
        (byte & 0b00110000) >> 4,
        (byte & 0b00001100) >> 2,
        (byte & 0b00000011)
      ]
      for (let j = 0; j < bits.length; j++){
        let rgba = BITMAP_PREVIEW_BYTES[bits[j]];
        previewBuffer.push(...rgba);
      }
    }

    this.bitmapPreviewBuffer = new Uint8ClampedArray(previewBuffer);
  }
}

class Processor {
  constructor(roms, tickerText) {
    this.roms = roms;
    this.menu = null;
    this.forceDMG = false;
    this.tickerBitmap = [];
    this.cartType = 0;
    this.englishPatch = false;
    this.tickerType = 1;
  }

  romTotalKB() {
    return this.roms.reduce((total, rom) => {
      return total += rom.romSizeKB();
    }, 0);
  }

  romUsedKB() {
    return this.roms.reduce((total, rom) => {
      return total += rom.paddedRomSizeKB();
    }, 0);
  }

  ramUsedKB() {
    return this.roms.reduce((total, rom) => {
      return total += rom.paddedRamSizeKB();
    }, 0);
  }

  romOverflow() {
    return (this.romUsedKB() > 896);
  }

  mapData(singleRom = false) {
    const mapBuffer = new ArrayBuffer(128);
    const mapFile = new FileSeeker(mapBuffer);

    let romOffset = 0;
    let ramOffset = 0;

    if (!singleRom) {
      // write mbc type, rom size, and ram size for menu
      mapFile.writeBytes([0xA8, 0, 0]);
      romOffset += 128;
    }

    // write mbc type, rom size, and ram size for each rom
    for (let i = 0; i < this.roms.length; i++) {
      let rom = this.roms[i];
      let bits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 16

      // set mbc bits
      let tb = rom.typeByte
      if (tb >= 0x01 && tb <= 0x03) {
        bits[15] = 0; bits[14] = 0; bits[13] = 1;
      } else if (tb >= 0x05 && tb <= 0x06) {
        bits[15] = 0; bits[14] = 1; bits[13] = 0;
      } else if (tb >= 0x0F && tb <= 0x13 ) {
        bits[15] = 0; bits[14] = 1; bits[13] = 1;
      } else if (tb >= 0x19 && tb <= 0x1E ) {
        bits[15] = 1; bits[14] = 0; bits[13] = 0;
      }

      // set rom bits
      let rs = rom.paddedRomSizeKB();
      if (rs == 64) { // 010
        bits[12] = 0; bits[11] = 1; bits[10] = 0;
      } else if (rs == 128) { // 010
        bits[12] = 0; bits[11] = 1; bits[10] = 0;
      } else if (rs == 256) { // 011
        bits[12] = 0; bits[11] = 1; bits[10] = 1;
      } else if (rs == 512) { // 100
        bits[12] = 1; bits[11] = 0; bits[10] = 0;
      } else { // 101
        bits[12] = 1; bits[11] = 0; bits[10] = 1;
      }

      // set ram bits
      if (rom.typeByte == 0x06) { // MBC2+BATTERY 001
        bits[9] = 0; bits[8] = 0; bits[7] = 1;
      } else if (rom.ramSizeKB == 0) { // No RAM 000
        bits[9] = 0; bits[8] = 0; bits[7] = 0;
      } else if (rom.ramSizeKB == 8) { // 8KB 010
        bits[9] = 0; bits[8] = 1; bits[7] = 0;
      } else if (rom.ramSizeKB >= 32) { // 32KB+ 011
        bits[9] = 0; bits[8] = 1; bits[7] = 1;
      } else { // < 8KB 010
        bits[9] = 0; bits[8] = 1; bits[7] = 0;
      }

      // rom offset and cart info bits
      bits.reverse();
      let bytes = [parseInt(bits.slice(0, 8).join(''), 2), parseInt(bits.slice(8, 16).join(''), 2)]
      bytes[1] = bytes[1] | Math.trunc(romOffset / 32);
      mapFile.writeBytes(bytes)
      romOffset += rom.paddedRomSizeKB();

      // ram offset
      mapFile.writeByte(Math.trunc(ramOffset / 2));
      // this is the way it was in C# source, don't really understand why everything gets 8
      ramOffset += (rom.typeByte === 0x06 || rom.ramSizeKB() < 8) ? 8 : rom.ramSizeKB();
    }

    // trailer
    mapFile.writeByteUntil(0xFF, 128 - MAP_TRAILER_BYTES.length);
    mapFile.writeBytes(MAP_TRAILER_BYTES);

    return new Uint8Array(mapBuffer);
  }

  romData() {
    const romBuffer = new ArrayBuffer(Math.pow(1024, 2));
    const romFile = new FileSeeker(romBuffer);

    // copy menu data
    romFile.writeBytes(this.menu.data);

    // apply iG power cart hack
    if (this.cartType == 1) {
      this.patchRomHeaderForIG(romFile);
    }

    // apply dmg menu hack
    if (this.forceDMG) {
      romFile.seek(0x100);
      romFile.writeByte(0xAF);
      romFile.seek(0x150);
      romFile.writeBytes([0x3C, 0xE0, 0xFE, 0x3D]);
    }

    // apply english patch
    if (this.englishPatch && typeof ENGLISH_PATCH_DATA === 'object') {
      const englishRomPatcher = new Patcher(ENGLISH_PATCH_DATA);
      englishRomPatcher.apply(romFile);
    }

    // ticker text
    if (this.tickerType == 1) {
      romFile.seek(0x18040);
      romFile.writeByteUntil(0x00, 0x19140); // overwrite existing data
      romFile.seek(0x18040);
      romFile.writeBytes(Array.from(this.tickerBitmap));
    }

    let romBase = 0x01;
    let romFileIndex = 0x1C200;

    // disable existing entries
    for (let i = 0; i < 7; i++) {
      romFile.seek(romFileIndex + i * 512);
      romFile.writeByte(0xFF);
    }


    // used in loop for iG power cart hack   
    let iGOffsets = { rom: 8, ram: 0 };

    for (let i = 0; i < this.roms.length; i++) {
      const rom = this.roms[i];
      romFile.seek(romFileIndex);

      // rom index
      romFile.writeByte(i + 1);

      // rom base (in 128k units)
      romFile.writeByte(romBase)
      romBase += Math.trunc(rom.paddedRomSizeKB() / 128);

      // sram base? (this is zero in the source)
      romFile.writeByte(0);

      // rom size (in 128k units)
      romFile.writeByte(Math.trunc(rom.paddedRomSizeKB() / 128));
      romFile.writeByte(0);

      // sram "block BBBBBB" flags
      romFile.writeByte(rom.paddedRamSizeKB() > 0 ? 1 : 0); // true if 8 used
      romFile.writeByte(rom.paddedRamSizeKB() > 8 ? 1 : 0); // true if 32 used

      romFile.seek(romFileIndex + 63);

      // title bitmap
      romFile.writeBytes(rom.bitmapBuffer);

      romFileIndex += 512
    
      // apply iG power cart hack
      if (this.cartType == 1) {
        this.patchBankInfoForIG(rom, romFile, iGOffsets, i);
      }
    }

    // write the roms
    romFile.seek(0x20000)
    for (let i = 0; i < this.roms.length; i++) {
      romFile.writeBytes(new Uint8Array(this.roms[i].arrayBuffer));
    }

    return new Uint8Array(romBuffer);
  }

  patchRomHeaderForIG(romFile) {
    romFile.seek(0x130E); // For CGB+
    romFile.writeBytes([0xC3, 0x00, 0x1F]); // Jump to 0x1F00
    
    romFile.seek(0x140F); // For DMG/Pocket
    romFile.writeBytes([0xC3, 0x00, 0x1F]); // Jump to 0x1F00
       
    // Set rom bank, ram enabled/disabled, 8KB/32KB locked and ram bank
    romFile.seek(0x1F00);
    romFile.writeBytes([0x3e, 0x01, 0xea, 0x00, 0x20, // Set 0x2000, 1
    0xf0, 0xfd, 0x01, 0x00, 0x22, 0x4f, 0x0a, 0xea, 0x00, 0x40, 0x3e, 0x00, 0xea, 0x00, 0x40, // Ram bank set bit 1+. 8KB/32KB locking = bit 0
    0xf0, 0xfd, 0x01, 0x00, 0x21, 0x4f, 0x0a, 0xea, 0x00, 0x00, // Ram enable/disable
    0xf0, 0xfd, 0x01, 0x00, 0x20, 0x4f, 0x0a, 0xea, 0x00, 0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // Rom bank and restart GB
    
    // Patch out any writes to 0x0000-0x1000
    romFile.seek(0x0DDF);
    romFile.writeBytes([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    romFile.seek(0x0E22);
    romFile.writeBytes([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  patchBankInfoForIG(rom, romFile, offsets, i) {
    // Set rom bank start
    romFile.seek(0x2001 + i);
    if (rom.typeByte >= 1 && rom.typeByte <= 3) {// MBC1 enabled, setting bank 0 = bank 1
      romFile.writeByte(offsets.rom | 0x01);
    }
    else {
      romFile.writeByte(offsets.rom);
    }
    offsets.rom += Math.trunc(rom.paddedRomSizeKB() / 16);
    
    // Set ram state
    romFile.seek(0x2101 + i);
    if (rom.ramByte > 0 || rom.typeByte == 0x06) { // has ram or MBC2
      romFile.writeByte(1); // Ram enabled
    }
    else {
      romFile.writeByte(0); // Ram disabled
    }
    
    // Set ram bank info
    romFile.seek(0x2201 + i);
    
    // Ram offset and if we are 8KB or 32KB locked
    if (rom.ramByte == 2 || rom.typeByte == 0x06) { // 8KB or MBC2+RAM
      romFile.writeByte(offsets.ram); // 8KB locked
    }
    else if (rom.ramByte == 3) { // 32KB
      romFile.writeByte(offsets.ram | 0x01); // 32KB locked
    }
    else {
      romFile.writeByte(0);
    }
    
    // Increment ram offset after
    if (rom.ramByte == 2 || rom.typeByte == 0x06) { // 8KB or MBC2+RAM
      offsets.ram += 2;
    }
    else if (rom.ramByte == 3) { // 32KB
      offsets.ram += 4;
    }
  }

  parseMenuData(menuBuffer, fontIndex) {
    const roms = [];
    const menuFile = new FileSeeker(menuBuffer);

    menuFile.seek(0x134);
    const title = String.fromCharCode(...menuFile.read(0xF)).replace(/\0/g, '');
    if (!title.includes(MENU_TITLE_CHECK)) {
      alert(`${title} does not appear to be a menu ROM!\nDid you select a regular ROM by mistake?`);
      return [];
    }

    let romSizes = [];
    for (let i = 0; i < 7; i++) {
      const indexPosition = 0x1C200 + i * 512
      menuFile.seek(indexPosition);
      const byte = menuFile.readByte();
      if (byte > 0 && byte < 8) {
        menuFile.seek(indexPosition + 3)
        romSizes.push(menuFile.readByte());
      }
    }

    if (romSizes.length > 0) {
      try {
        menuFile.seek(0x20000)
        for (let i = 0; i < romSizes.length; i++) {
          const romData = menuFile.read(romSizes[i] * 128 * 1024);
          const romBuffer = (new Uint8Array(romData)).buffer;
          roms.push(new ROM(romBuffer, fontIndex))
        }
      } catch(e) {
        console.log(e)
        alert("Failed to parse roms from menu file!");
      }
    } else {
      alert("No roms detected in menu file!")
    }

    return roms;
  }
}

class TickerText {
  constructor(text, fontIndex, canvas) {
    this.text = text;
    this.fontIndex = fontIndex;
    this.canvas = canvas;
  }

  generate() {
    let buffer = [];
    const canvas = this.canvas;
    let text = this.text;
    if (this.fontIndex == 3) {
      text = text.toUpperCase();
    }
    const font =  FONTS[this.fontIndex].style;
    console.log(font);

    const ctx = canvas.getContext('2d');
    ctx.font = font;
    let width = Math.ceil(ctx.measureText(text).width) + 2
    for (let i = 0; i < 16; i++) {
      if ((width % 16) == 0) { break; }
      width++
    }
    width = Math.min(1024, Math.max(64, width));

    canvas.width = width;
    ctx.font = font;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.fillText(text,1,12);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let i = 0; i < imageData.length; i+=16){
      let byte = 0;
      for (let j = 0; j < 4; j++) {
        let red = imageData[i+j*4];
        if (red < 210) {
          byte = byte | 0b11 << (6 - j*2);
        } 
      }
      buffer.push(byte)
    }

    let outputBuffer = []
    for (let h = 0; h < Math.trunc(canvas.width/4); h+=2) {
      for (let i = h; i < canvas.width * 4; i+=Math.trunc(canvas.width/4)) {
        let a = buffer[i]
        let b = buffer[i+1]

        let outputA =
          (a & 0b10000000) | ((a & 0b00100000) << 1) | ((a & 0b00001000) << 2) | ((a & 0b00000010) << 3) |
          ((b & 0b10000000) >> 4) | ((b & 0b00100000) >> 3) | ((b & 0b00001000) >> 2) | ((b & 0b00000010) >> 1);
        let outputB =
          ((a & 0b01000000) << 1) | ((a & 0b00010000) << 2) | ((a & 0b00000100) << 3) | ((a & 0b00000001) << 4) |
          ((b & 0b01000000) >> 3) | ((b & 0b00010000) >> 2) | ((b & 0b00000100) >> 1) | (b & 0b00000001);

        outputBuffer.push(outputA, outputB);
      }
    }

    return outputBuffer;
  }
}

class Patcher {
  constructor(patchData) {
    this.patchData = patchData;
  }

  apply(file) {
    const originalPosition = file.position;
    this.patchData.forEach((patch) => {
      file.seek(patch.address);
      if (patch.rleData) {
        patch.rleData.forEach((data) => {
          if (Array.isArray(data)) {
            for (let i = 0; i < data[1]; i++) { file.writeByte(data[0]); }
          } else {
            file.writeByte(data)
          }
        })
      } else {
        file.writeBytes(patch.data);
      }
    });
    file.seek(originalPosition);
  }
}

class FileSeeker {
  constructor(arrayBuffer) {
    this.view = new DataView(arrayBuffer);
    this.position = 0;
  }

  seek(address) {
    this.position = address;
  }

  rewind() {
    this.position = 0;
  }

  size() {
    return this.view.byteLength;
  }

  read(bytes) {
    let data = [];
    for (let i = 0; i < bytes; i++) {
      data.push(this.readByte());
    }
    return data;
  }

  readByte() {
    let byte = this.view.getUint8(this.position);
    this.position++;
    return byte;
  }

  writeByte(byte) {
    this.view.setUint8(this.position, byte);
    this.position++;
  }

  writeBytes(bytes) {
    for (let i = 0; i < bytes.length; i++) {
      this.writeByte(bytes[i]);
    }
  }

  writeByteUntil(byte, stop) {
    while (this.position < stop) {
      this.writeByte(byte)
    }
  }
}
