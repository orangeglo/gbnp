const parseBool = (boolString) => {
  return boolString.toLowerCase() === 'true';
};

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
  props: ['processor', 'fontsLoaded', 'fontIndex', 'show'],
  data: function() {
    return ({
      text: "Created with GBNP on " + (new Date).toISOString().slice(0, 10)
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
    <div :class="{ hide: !show }" class="ticker-settings">
      <div>
        <input style="width: 450px;" type="text" v-model="text"/>
      </div>

      <div style="height: 17px; background-color: black">
        <img src="img/ticker_logo.png" style="height: 16px; padding-top: 1px"/>
        <canvas id="ticker-canvas" ref="canvas" height="16" style="vertical-align: top"></canvas>
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
    singleRomMapData: '',
    fontIndex: 0,
    forceDMG: false,
    englishPatch: false,
    cartType: 0,
    tickerType: 1,
    fontsLoaded: false,
  },
  created: function() {
    this.loadSettingsFromStorage();

    this.processor.menu = this.menu;
    this.processor.tickerText = this.tickerText;
    this.processor.forceDMG = this.forceDMG;
    this.processor.englishPatch = this.englishPatch;
    this.processor.tickerType = this.tickerType;

    if (window.location.search.substr(1).toLowerCase() == 'ig') {
      this.cartType = 1;
    }

    window.addEventListener('error', (e) => {
      alert("Whoops, some sort of exception occured! Open an issue in the GitHub repo to tell me what happened, or message me on Discord (info in footer).")
    });
  },
  computed: {
    downloadEnabled: function() {
      return this.menu.present() && !this.romOverflow;
    },
    mapEnabled: function() {
      return this.cartType == 0;
    },
    romOverflow: function() { return this.processor.romOverflow(); },
    overflowClassMsg: function() {
      if (this.processor.roms.length === 1 && this.processor.roms[0].paddedRomSizeKB() === 1024) {
        return { class: 'single-rom', msg: "Game only (no menu)" };
      } else if (this.romOverflow) {
        return { class: 'overflow', msg: "Limit is 7 blocks" };
      }
      return { class: null, msg: null };
    },
    singleRomMapEnabled: function() {
      return this.mapEnabled
        && this.processor.roms.length === 1
        && this.processor.roms[0].paddedRomSizeKB() <= 1024;
    },
    singleRomFilename: function() {
      return this.processor.roms[0] ? this.processor.roms[0].title : '';
    }
  },
  watch: {
    roms: function() { this.processor.roms = this.roms; },
    forceDMG: function() {
      this.processor.forceDMG = this.forceDMG;
      this.writeSettingsToStorage();
    },
    cartType: function() {
      this.processor.cartType = this.cartType;
      this.writeSettingsToStorage();
    },
    englishPatch: function() {
      this.processor.englishPatch = this.englishPatch;
      this.writeSettingsToStorage();
    },
    tickerType: function() {
      this.processor.tickerType = this.tickerType;
      this.writeSettingsToStorage();
    },
    fontIndex: function() {
      for (let i = 0; i < this.roms.length; i++) { this.roms[i].updateBitmap(this.fontIndex); }
      this.writeSettingsToStorage();
    },
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

      if (e) { e.target.value = ''; }
    },
    removeROM: function(index) {
      this.roms.splice(index, 1);
    },
    removeAllRoms: function() {
      this.roms = [];
    },
    moveUp: function(index) {
      let rom = this.roms[index];
      this.roms.splice(index, 1);
      this.roms.splice(index - 1, 0, rom);
    },
    moveDown: function(index) {
      let rom = this.roms[index];
      this.roms.splice(index, 1);
      this.roms.splice(index + 1, 0, rom);
    },
    downloadMapFile: function(e) {
      this.processor.roms = this.roms; // in case they got out of sync
      if (this.cartType == 0) { // regular power cart only
        if (this.mapData) { URL.revokeObjectURL(this.mapData) }
        this.mapData = URL.createObjectURL(new Blob([this.processor.mapData()]));
      }
    },
    downloadSingleRomMapFile: function(e) {
      this.processor.roms = this.roms; // in case they got out of sync
      if (this.cartType == 0) { // regular power cart only
        if (this.singleRomMapData) { URL.revokeObjectURL(this.singleRomMapData) }
        this.singleRomMapData = URL.createObjectURL(new Blob([this.processor.mapData(true)]));
      }
    },
    downloadRomFile: function(e) {
      this.processor.roms = this.roms; // in case they got out of sync
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
    writeSettingsToStorage: function () {
      window.localStorage.setItem('fontIndex', this.fontIndex);
      window.localStorage.setItem('forceDMG', this.forceDMG);
      window.localStorage.setItem('englishPatch', this.englishPatch);
      window.localStorage.setItem('cartType', this.cartType);
      window.localStorage.setItem('tickerType', this.tickerType);
    },
    loadSettingsFromStorage: function() {
      const fontIndex = window.localStorage.getItem('fontIndex');
      const forceDMG = window.localStorage.getItem('forceDMG');
      const englishPatch = window.localStorage.getItem('englishPatch');
      const cartType = window.localStorage.getItem('cartType');
      const tickerType = window.localStorage.getItem('tickerType');

      if (fontIndex) { this.fontIndex = parseInt(fontIndex); }
      if (forceDMG) { this.forceDMG = parseBool(forceDMG); }
      if (englishPatch) { this.englishPatch = parseBool(englishPatch); }
      if (cartType) { this.cartType = parseInt(cartType); }
      if (tickerType) { this.tickerType = parseInt(tickerType); }
    },
    triggerAddMenuLabel: function(e) { this.$refs.addMenuLabel.click(); },
    triggerAddRomLabel: function(e) { this.$refs.addRomLabel.click(); },
    stopPropagation: function(e) { e.stopImmediatePropagation(); },
    preventDefault: function(e) { e.preventDefault(); },
  }
});

Vue.component('bitmap-preview', {
  props: ['data', 'rom', 'index'],
  mounted: function() {
    this.renderCanvas();
    console.log(this.rom.title);
  },
  watch: {
    data: function() {
      this.renderCanvas();
    }
  },
  methods: {
    renderCanvas: function() {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(new ImageData(this.data, 96, 8), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(2, 2);
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    addImage: function(e) {
      const rom = this.rom;
      const imageReader = new FileReader();
      imageReader.onload = function(e) {
        const img = new Image();
        img.addEventListener("load", function(e) {
          rom.updateBitmap(null, e.target);
        });
        img.src = e.target.result;
      };       
      imageReader.readAsDataURL(e.target.files[0]);
    },
    triggerAddImageLabel: function () { this.$refs.addImageLabel.click(); },
    stopPropagation: function(e) { app.stopPropagation(e); }
  },
  template: `
    <div>
      <canvas width="192" height="16" ref="canvas"></canvas>
      <button v-on:click="triggerAddImageLabel" type="button">
        <label :for="'imageFileInput-' + index" ref="addImageLabel" v-on:click="stopPropagation">Upload</label>
      </button>
      <input style="display: none" :id="'imageFileInput-' + index" type="file" v-on:change="addImage">
    </div>`
});

