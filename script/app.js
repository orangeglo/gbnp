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
  template: '<canvas style="vertical-align: middle" width="256" height="16" ref="canvas"></canvas>'
});

Vue.component('ticker-settings', {
  props: ['processor', 'fontsLoaded', 'fontIndex'],
  data: function() {
    return ({
      text: "Created with GBNP on " + (new Date).toISOString().slice(0, 10) + "!"
    });
  },
  methods: {
    updateBitmap: function() {
      const bitmap = (new TickerText(this.text, this.fontIndex, this.$refs.canvas)).generate()
      this.processor.tickerBitmap = bitmap;
    }
  },
  watch: {
    fontIndex: function() { this.updateBitmap() },
    fontsLoaded: function () { this.updateBitmap() },
    text: function() { this.updateBitmap() }
  },
  template: `
    <div class="settings-row">
      <span class="settings-label">Ticker Text: </span>

      <div style="display:inline-block;">
        <div>
          <input style="width: 450px;" type="text" v-model="text"/>
        </div>

        <div style="height: 17px; background-color: black">
          <img src="img/ticker_logo.png" style="height: 16px; padding-top: 1px"/>
          <canvas id="ticker-canvas" ref="canvas" height="16" style="vertical-align: top"></canvas>
        </div>
      </div>
    </div>
  `
});

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
    forceDMG: false,
    fontsLoaded: false,
    cartType: 0
  },
  created: function() {
    this.processor.menu = this.menu;
    this.processor.tickerText = this.tickerText;
    this.processor.forceDMG = this.forceDMG;

    if (window.location.search.substr(1).toLowerCase() == 'ig') {
      this.cartType = 1;
    }
  },
  computed: {
    downloadEnabled: function() {
      return this.menu.present() && !this.romOverflow;
    },
    mapEnabled: function() {
      return this.cartType == 0;
    },
    romOverflow: function() { return this.processor.romOverflow(); }
  },
  watch: {
    fontIndex: function() {
      for (let i = 0; i < this.roms.length; i++) { this.roms[i].updateBitmap(this.fontIndex); }
    },
    forceDMG: function() { this.processor.forceDMG = this.forceDMG; },
    cartType: function() { this.processor.cartType = this.cartType; }
  },
  methods: {
    addMenu: function(e) {
      let fileReader = new FileReader()
      fileReader.onload = () => {
        const parsedRoms = this.processor.parseMenuData(fileReader.result, this.fontIndex);
        if (parsedRoms.length > 0) { this.roms = parsedRoms; }
      }
      fileReader.readAsArrayBuffer(e.target.files[0]);

      e.target.value = '';
    },
    addROM: function(e, f) {
      const files = f || e.target.files;
      for (let i = 0; i < files.length; i++) {
        let fileReader = new FileReader();
        fileReader.onload = () => {
          const rom = new ROM(fileReader.result, this.fontIndex);
          if (rom.isMenu()) {
            const parsedRoms = this.processor.parseMenuData(fileReader.result, this.fontIndex);
            parsedRoms.forEach((rom) => this.roms.push(rom));
          } else if (!rom.bad) {
            this.roms.push(rom);
          }
        }
        fileReader.readAsArrayBuffer(files[i]);
      }

      this.processor.roms = this.roms;

      if (e) { e.target.value = ''; }
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
      if (this.cartType == 0) { // regular power cart only
        if (this.mapData) { URL.revokeObjectURL(this.mapData) }
        this.mapData = URL.createObjectURL(new Blob([this.processor.mapData()]));
      }
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
    dropFile: function(e) {
      this.addROM(null, e.dataTransfer.files);
      e.target.classList.remove('over')
      e.preventDefault();
    },
    triggerAddMenuLabel: function(e) { this.$refs.addMenuLabel.click(); },
    triggerAddRomLabel: function(e) { this.$refs.addRomLabel.click(); },
    stopPropagation: function(e) { e.stopImmediatePropagation(); },
    preventDefault: function(e) { e.preventDefault(); },
  }
});

document.fonts.ready.then(function() { app.fontsLoaded = true });
