export class SeaAudio {
  constructor() {
    this.enabled = true;
    this.started = false;
    this.bgm = new Audio("./assets/music/bgm.ogg");
    this.bgm.loop = true;
    this.bgm.volume = 0.35;
    this.sounds = {
      click: new Audio("./assets/sfx/click.ogg"),
      bite: new Audio("./assets/sfx/bite.ogg"),
      splash: new Audio("./assets/sfx/splash.ogg"),
      catch: new Audio("./assets/sfx/catch.ogg"),
      snap: new Audio("./assets/sfx/snap.ogg"),
    };
    for (const sound of Object.values(this.sounds)) {
      sound.volume = 0.55;
    }
  }

  async start() {
    if (this.started) return;
    this.started = true;
    if (this.enabled) {
      this.bgm.currentTime = 0;
      await this.bgm.play().catch(() => {});
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.bgm.pause();
      return;
    }
    if (this.started) {
      void this.bgm.play().catch(() => {});
    }
  }

  suspend() {
    this.bgm.pause();
    for (const sound of Object.values(this.sounds)) {
      sound.pause();
    }
  }

  resume() {
    if (this.enabled && this.started) {
      void this.bgm.play().catch(() => {});
    }
  }

  play(name) {
    if (!this.enabled) return;
    const sound = this.sounds[name];
    if (!sound) return;
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }
}
