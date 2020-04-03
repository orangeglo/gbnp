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
]
const FONTS = [
  { style: 'normal 16px Pixeltype', y: 7 },
  { style: 'normal 8px Gameboy', y: 7 },
  { style: 'normal 8px Nokia', y: 7 },
  { style: 'normal 16px Gamer', y: 7 }
]

class Menu {
  constructor() {
    this.data = null;
    const menuData = localStorage.getItem('menuData');
    if (menuData) {
      this.loadedFromStorage = true;
      this.data = JSON.parse(menuData).data;
    }
  }

  present() {
    return !!this.data
  }

  valid() {
    if (!this._valid && this.data) {
      let title = String.fromCharCode(...this.data.slice(308, 317));
      this._valid = (title == 'NP M-MENU');
    }

    return this._valid || false;
  }

  ready() {
    return this.present() && this.valid();
  }

  setData(arrayBuffer) {
    this._valid = null;
    this.data = new Uint8Array(arrayBuffer);
    if (this.valid()) {
      localStorage.setItem('menuData', JSON.stringify({ data: Array.from(this.data) }));
    }
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

    file.rewind();
    this.arrayBuffer = new ArrayBuffer(this.paddedRomSizeKB() * 1024);
    let paddedFile = new FileSeeker(this.arrayBuffer);
    paddedFile.writeBytes(file.read(file.size()));

    this.updateBitmap(fontIndex);

    if (!this.valid()) { alert('File is not a valid Game Boy ROM!') }
    if (!this.type) { alert('Cartridge type could not be determined!') }
    if (this.ramSizeKB() > 32) { alert('Game requires more than 32 KB of RAM!') }
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

  updateMenuText(text, fontIndex) {
    this.menuText = text;
    this.updateBitmap(fontIndex);
  }

  updateBitmap(fontIndex) {
    let buffer = [];

    const canvas = document.createElement("canvas");
    canvas.height = 8;
    canvas.width = 96;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 96, 8);
    const font = FONTS[fontIndex || 0];
    ctx.font = font.style;
    ctx.fillStyle = 'black';
    ctx.fillText(this.menuText,1,font.y);
    const imageData = ctx.getImageData(0, 0, 96, 8).data;

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
    for (let h = 0; h < 24; h+=2) {
      for (let i = h; i < 192; i+=24) {
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
  constructor(roms) {
    this.roms = roms;
    this.menu = null;
    this.disableCGB = false;
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
      return total += rom.ramSizeKB();
    }, 0);
  }

  romOverflow() {
    return (this.romUsedKB() > 896);
  }

  mapData() {
    const mapBuffer = new ArrayBuffer(128);
    const mapFile = new FileSeeker(mapBuffer);

    // write mbc type, rom size, and ram size for menu
    mapFile.writeBytes([0xA8, 0, 0]);

    // write mbc type, rom size, and ram size for each rom
    let romOffset = 128;
    let ramOffset = 0;

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
      ramOffset += (rom.typeByte == 0x06 || rom.ramSizeKB() < 8) ? 8 : rom.ramSizeKB();
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

    // apply cgb hack
    if (this.disableCGB) {
      romFile.seek(0x143);
      romFile.writeByte(0);
      romFile.seek(0x14D); // fix checksum
      romFile.writeByte(83);
    }

    // fix header checksum
    // let checksum = 0;
    // for (let i = 0x134; i <= 0x14C; i++) {
    //   romFile.seek(i);
    //   checksum = ((checksum - romFile.readByte() - 1) & 0xFF)
    // }
    // romFile.seek(0x14D); // fix checksum
    // romFile.writeByte(checksum);

    let romBase = 0x01;
    let romFileIndex = 0x1C200;

    // disable existing entries
    for (let i = 0; i < 7; i++) {
      romFile.seek(romFileIndex + i * 512);
      romFile.writeByte(0xFF);
    }

    for (let i = 0; i < this.roms.length; i++) {
      const rom = this.roms[i];
      romFile.seek(romFileIndex);

      // rom index
      romFile.writeByte(i + 1);

      // rom base (in 128k units)
      romFile.writeByte(romBase)
      romBase += Math.trunc(rom.paddedRomSizeKB() / 128);

      // sram base? (this is zero in the source)
      romFile.writeByte(0)

      // rom size (in 128k units)
      romFile.writeByte(Math.trunc(rom.paddedRomSizeKB() / 128));
      romFile.writeByte(0);

      // sram size in 32b units (this is zero in the source)
      romFile.writeByte(0)
      romFile.writeByte(0)

      romFile.seek(romFileIndex + 63);

      // title bitmap
      romFile.writeBytes(rom.bitmapBuffer);

      rom.bitmapBuffer

      romFileIndex += 512
    }

    // write the roms
    romFile.seek(0x20000)
    for (let i = 0; i < this.roms.length; i++) {
      romFile.writeBytes(new Uint8Array(this.roms[i].arrayBuffer));
    }

    return new Uint8Array(romBuffer);
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
