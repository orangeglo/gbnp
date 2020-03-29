let app = new Vue({
  el: '#app',
  data: {
    roms: [],
    processor: new Processor([]),
    mapData: ''
  },
  methods: {
    addFile: async function(e) {
      this.roms.push(new ROM(await e.target.files[0].arrayBuffer()));
      this.processor.roms = this.roms;

      e.target.value = '';
    },
    downloadMapFile: function(e) {
      if (this.mapData) { URL.revokeObjectURL(this.mapData) }
      this.mapData = URL.createObjectURL(new Blob([this.processor.mapData()]));
    }
  }
});
