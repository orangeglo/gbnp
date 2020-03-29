const CARTRIDGE_TYPES = [
  'ROM Only',
  'MBC1', 'MBC1+RAM', 'MBC1+RAM+BATTERY', null,
  'MBC2', 'MBC2+BATTERY', null,
  'ROM+RAM', 'ROM+RAM+BATTERY', null, null, null, null, null,
  'MBC3+TIMER+BATTERY', 'MBC3+TIMER+RAM+BATTERY', 'MBC3', 'MBC3+RAM', 'MBC3+RAM+BATTERY', null, null, null, null, null,
  'MBC5', 'MBC5+RAM', 'MBC5+RAM+BATTERY', 'MBC5+RUMBLE', 'MBC5+RUMBLE+RAM', 'MBC5+RUMBLE+RAM+BATTERY'
];
const MAP_TRAILER_BYTES = [0x02, 0x00, 0x30, 0x12, 0x99, 0x11, 0x12, 0x20, 0x37, 0x57, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00];

class ROM {
  constructor(arrayBuffer) {
    this._arrayBuffer = arrayBuffer;
    let file = new FileSeeker(arrayBuffer);

    file.seek(0x134);
    this.title = String.fromCharCode(...file.read(0xF));

    file.seek(0x143);
    let cgbByte = file.readByte();
    this.cgb = cgbByte == 0x80 || cgbByte == 0xC0;

    file.seek(0x147);
    this.typeByte = file.readByte();
    this.type = CARTRIDGE_TYPES[this.typeByte];
    this.romByte = file.readByte();
    this.ramByte = file.readByte();

    // add error for rom too big, ram over 32KB, unknown type
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

  async arrayBuffer() {
    return await ArrayBuffer.transfer(this._arrayBuffer, this.paddedRomSizeKB());
  }
}

class Processor {
  constructor(roms) {
    this.roms = roms;
  }

  romUsedKB() {
    return this.roms.reduce((total, rom) => {
      return total += rom.paddedRomSizeKB();
    }, 0);
  }

  ramUsedKB() {
    // how to handle mcb2
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
    mapFile.writeByteUntil(0xFF, 128 - FINAL_BYTES.length);
    mapFile.writeBytes(FINAL_BYTES);

    return new Uint8Array(mapBuffer);
  }

  romData() {
    const romBuffer = new ArrayBuffer(math.pow(1024, 2));
    const romFile = new FileSeeker(romBuffer);
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
