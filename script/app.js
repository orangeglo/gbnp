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
    forceDMG: false
  },
  created: function() {
    this.processor.menu = this.menu;
    this.processor.disableCGB = this.disableCGB;
    this.processor.forceDMG = this.forceDMG;
  },
  computed: {
    downloadEnabled: function() {
      return (this.roms.length > 0) && this.menu.present() && this.menu.valid() && !this.romOverflow;
    },
    romOverflow: function() { return this.processor.romOverflow(); }
  },
  watch: {
    fontIndex: function() {
      for (let i = 0; i < this.roms.length; i++) { this.roms[i].updateBitmap(this.fontIndex); }
    },
    disableCGB: function() {
      this.processor.disableCGB = this.disableCGB;
    },
    forceDMG: function() {
      this.processor.forceDMG = this.forceDMG;
    }
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
      fileReader.onload = () => this.roms.push(new ROM(fileReader.result, this.fontIndex));
      for (let i = 0; i < e.target.files.length; i++){
        fileReader.readAsArrayBuffer(e.target.files[i]);
      }

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

