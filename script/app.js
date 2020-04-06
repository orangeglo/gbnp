let app = new Vue({
  el: '#app',
  data: {
    menu: new Menu(),
    roms: [],
    processor: new Processor([]),
    filename: 'GBNP',
    mapData: '',
    romData: '',
    fontIndex: 0,
    disableCGB: false,
    forceDMG: false,
    tickerText: new TickerText("Created with GBNP, orangeglo.github.io/gbnp/")
  },
  created: function() {
    this.processor.menu = this.menu;
    this.processor.tickerText = this.tickerText;
    this.processor.disableCGB = this.disableCGB;
    this.processor.forceDMG = this.forceDMG;
  },
  computed: {
    downloadEnabled: function() {
      return this.menu.present() && !this.romOverflow;
    },
    romOverflow: function() { return this.processor.romOverflow(); }
  },
  watch: {
    fontIndex: function() {
      for (let i = 0; i < this.roms.length; i++) { this.roms[i].updateBitmap(this.fontIndex); }
    },
    disableCGB: function() { this.processor.disableCGB = this.disableCGB; },
    forceDMG: function() { this.processor.forceDMG = this.forceDMG; }
  },
  methods: {
    addMenu: function(e) {
      let fileReader = new FileReader()
      fileReader.onload = () => {
        this.roms = this.processor.parseMenuData(fileReader.result, this.fontIndex);
      }
      fileReader.readAsArrayBuffer(e.target.files[0]);

      e.target.value = '';
    },
    addROM: function(e) {
      const files = e.target.files;
      for (let i = 0; i < files.length; i++) {
        let fileReader = new FileReader();
        fileReader.onload = () => {
          this.roms.push(new ROM(fileReader.result, this.fontIndex));
        }
        fileReader.readAsArrayBuffer(files[i]);
      }

      this.processor.roms = this.roms;

      e.target.value = '';
    },
    removeROM: function(index) {
      this.roms.splice(index, 1);
      this.processor.roms = this.roms;
    },
    removeAllRoms: function() {
      this.roms = [];
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
    updateMenuText: function(rom, val) {
      if (rom.bitmapTimeoutHandle) { clearTimeout(rom.bitmapTimeoutHandle); }
      rom.bitmapTimeoutHandle = setTimeout(() => {
        rom.updateMenuText(val, this.fontIndex);
      }, 500);
    },
    stopPropagation: function(e) { e.stopImmediatePropagation(); },
    triggerAddMenuLabel: function(e) { this.$refs.addMenuLabel.click(); },
    triggerAddRomLabel: function(e) { this.$refs.addRomLabel.click(); }
  }
});

Vue.component('bitmap-preview', {
  props: ['data'],
  mounted: function() {
    this.renderCanvas();
  },
  watch: {
    data: function() {
      this.renderCanvas();
    }
  },
  methods: {
    renderCanvas: function() {
      let canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(new ImageData(this.data, 128, 8), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(2, 2);
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  },
  template: '<canvas width="256" height="16" ref="canvas"></canvas>'
});
