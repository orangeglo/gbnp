const CARTRIDGE_TYPES = [
  'ROM Only',
  'MBC1', 'MBC1+RAM', 'MBC1+RAM+BATTERY', null,
  'MBC2', 'MBC2+BATTERY', null,
  'ROM+RAM', 'ROM+RAM+BATTERY', null, null, null, null, null,
  'MBC3+TIMER+BATTERY', 'MBC3+TIMER+RAM+BATTERY', 'MBC3', 'MBC3+RAM', 'MBC3+RAM+BATTERY', null, null, null, null, null,
  'MBC5', 'MBC5+RAM', 'MBC5+RAM+BATTERY', 'MBC5+RUMBLE', 'MBC5+RUMBLE+RAM', 'MBC5+RUMBLE+RAM+BATTERY'
]

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
    if (this._mapData) {

    } else {
      let mapBuffer = ArrayBuffer(128);
      let map = new DataView(mapBuffer);
    }
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
    this.view.setUint8(byte);
    this.position++;
  }

  writeBytes(bytes) {
    for (const byte in bytes) {
      this.writeByte(byte);
    }
  }
}
