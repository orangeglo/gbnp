let app = new Vue({
  el: '#app',
  data: {
    menu: new Menu(),
    roms: [],
    processor: new Processor([]),
    filename: 'output',
    mapData: '',
    romData: ''
  },
  created: function() {
    this.processor.menu = this.menu;
  },
  methods: {
    addMenu: function(e) {
      let fileReader = new FileReader()
      fileReader.onload = () => this.menu.setData(fileReader.result);
      fileReader.readAsArrayBuffer(e.target.files[0]);

      e.target.value = '';
    },
    addROM: function(e) {
      let fileReader = new FileReader()
      fileReader.onload = () => this.roms.push(new ROM(fileReader.result));
      fileReader.readAsArrayBuffer(e.target.files[0]);

      this.processor.roms = this.roms;

      e.target.value = '';
    },
    removeROM: function(index) {
      this.roms.splice(index, 1);
      this.processor.roms = this.roms;
    },
    moveUp: function(index) {
      let rom = this.roms[index];
      this.roms.splice(index, 1);
      this.roms.splice(index - 1, 0, rom);
      this.processor.roms = this.roms;
    },
    moveDown: function(index) {
      let rom = this.roms[index];
      this.roms.splice(index, 1);
      this.roms.splice(index + 1, 0, rom);
      this.processor.roms = this.roms;
    },
    downloadMapFile: function(e) {
      if (this.mapData) { URL.revokeObjectURL(this.mapData) }
      this.mapData = URL.createObjectURL(new Blob([this.processor.mapData()]));
    },
    downloadRomFile: function(e) {
      if (this.romData) { URL.revokeObjectURL(this.romData) }
      this.romData = URL.createObjectURL(new Blob([this.processor.romData()]));
    },
    downloadEnabled: function() {
      return (this.roms.length > 0) && this.menu.present() && this.menu.valid() ;
    }
  }
});
