let app = new Vue({
  el: '#app',
  data: {
    roms: [],
    processor: new Processor([])
  },
  methods: {
    addFile: async function(e) {
      this.roms.push(
        new ROM(
          await e.target.files[0].arrayBuffer()
        )
      );

      console.log(this.roms)
      this.processor.roms = this.roms;

      e.target.value = '';
    }
  }
});
