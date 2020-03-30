let app = new Vue({
  el: '#app',
  data: {
    roms: [],
    processor: new Processor([]),
    filename: 'output',
    mapData: '',
    romData: ''
  },
  methods: {
    addFile: async function(e) {
      this.roms.push(new ROM(await e.target.files[0].arrayBuffer()));
      this.processor.roms = this.roms;

      e.target.value = '';
    },
    removeFile: function(index) {
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
    }
  }
});
