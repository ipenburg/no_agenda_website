import jQuery from 'jquery';
import 'waud.js';

import {getProxyUrl} from './proxy';

class AudioPlayerElement extends HTMLElement {
  connectedCallback() {
    this.duration = 0;
    this.episode = null;
    this.hash = false;
    this.playerUrl = false;
    this.playing = false;
    this.speed = 1;
    this.src = null;
    this.timestamp = 0;
    this.title = null;

    Waud.init();

    this.addEventListener('audio-seek', () => {
      if (this.episode) {
        const cover = document.querySelector(`octopod-cover[episode="${this.episode}"]`);

        if (cover) {
          cover.currentTime = this.timestamp;
        }
      }
    });

    this.addEventListener('audio-step', () => {
      if (this.episode) {
        const cover = document.querySelector(`octopod-cover[episode="${this.episode}"]`);

        if (cover) {
          cover.currentTime = this.timestamp;
        }
      }
    });
  }

  init() {
    this.sound = new WaudSound(this.src, {
      autoplay: false,
      loop: false,
      webaudio: false,
      onload: () => {
        this.duration = this.sound.getDuration();

        this.dispatchEvent(new Event('audio-loaded'));

        this.dispatchEvent(new CustomEvent('audio-seek', {
          detail: {
            timestamp: this.timestamp,
          },
        }));
      },
      onend: () => {
        this.playing = false;
        this.timestamp = 0;

        this.dispatchEvent(new CustomEvent('audio-step', {
          detail: {
            timestamp: 0,
          },
        }));
        this.dispatchEvent(new Event('audio-pause'));
      }
    });
  }

  load(src, title, hash, playerUrl, episode) {
    if (this.sound) {
      this.sound.destroy();
      this.sound = null;

      this.playing = false;
      this.timestamp = 0;

      this.dispatchEvent(new Event('audio-pause'));
    }

    this.src = getProxyUrl(src);
    this.title = title;
    this.hash = hash;
    this.playerUrl = playerUrl;
    this.episode = episode;

    this.dispatchEvent(new CustomEvent('track-loaded', {
      detail: {
        title: this.title,
        playerUrl: this.playerUrl,
        episode: this.episode,
      },
    }));

    this.init();
  }

  play() {
    if (this.playing) {
      return;
    }

    this.playing = true;
    this.sound.play();

    const timestamp = this.sound.getTime() || 0;

    if (timestamp !== this.timestamp) {
      this.sound.setTime(this.timestamp);
    }

    requestAnimationFrame(this.step.bind(this));

    this.dispatchEvent(new Event('audio-start'));
  }

  pause() {
    if (!this.playing) {
      return;
    }

    this.playing = false;
    this.sound.pause();

    this.dispatchEvent(new Event('audio-pause'));
  }

  seekTimestamp(timestamp) {
    if (this.playing) {
      this.sound.setTime(timestamp);
    } else {
      this.timestamp = timestamp;
    }

    this.dispatchEvent(new CustomEvent('audio-seek', {
      detail: {
        timestamp: timestamp,
      },
    }));
  }

  setSpeed(speed) {
    this.sound.playbackRate(speed);

    this.dispatchEvent(new CustomEvent('audio-speed', {
      detail: {
        speed: speed,
      },
    }));
  }

  step() {
    if (this.sound && this.playing) {
      const timestamp = this.sound.getTime() || 0;

      if (this.timestamp !== timestamp) {
        this.timestamp = timestamp;

        this.dispatchEvent(new CustomEvent('audio-step', {
          detail: {
            timestamp: timestamp,
          },
        }));
      }

      requestAnimationFrame(this.step.bind(this));
    }
  }
}

export class HTMLAudioAwareElement extends HTMLElement {
  getSource() {
    if (this.source) {
      return this.source;
    }

    const targetId = this.dataset.target;

    if (!targetId) {
      return false;
    }

    this.source = document.getElementById(targetId);

    return this.source;
  }

  isActiveSource() {
    return !this.getSource() || this.getSource().hash === this.getPlayer().hash;
  }

  getPlayer() {
    if (this.getSource() && this.getSource().clip) {
      return this.getSource().getPlayer();
    } else {
      return getPlayer();
    }
  }
}

class AudioPlayButtonElement extends HTMLAudioAwareElement {
  constructor() {
    super();

    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.onStartAudio = this.onStartAudio.bind(this);
    this.onPauseAudio = this.onPauseAudio.bind(this);
    this.onStartGlobalAudio = this.onStartGlobalAudio.bind(this);
  }

  connectedCallback() {
    this.playButton = this.querySelector('[data-play-button]');
    this.pauseButton = this.querySelector('[data-pause-button]');

    this.playButton.addEventListener('click', this.play);
    this.pauseButton.addEventListener('click', this.pause);
    this.getPlayer().addEventListener('audio-start', this.onStartAudio);
    this.getPlayer().addEventListener('audio-pause', this.onPauseAudio);

    if (this.isActiveSource() && this.getPlayer().playing) {
      this.updateButtons(true);
    }
  }

  disconnectedCallback() {
    this.playButton.removeEventListener('click', this.play);
    this.pauseButton.removeEventListener('click', this.pause);
    this.getPlayer().removeEventListener('audio-start', this.onStartAudio);
    this.getPlayer().removeEventListener('audio-pause', this.onPauseAudio);
  }

  play() {
    if (!this.isActiveSource()) {
      this.getSource().initialize();
    }

    if (this.getSource().clip) {
      if (getPlayer().playing) {
        getPlayer().pause();
      }

      getPlayer().addEventListener('audio-start', this.onStartGlobalAudio);
    }

    this.getPlayer().play();
  }

  pause() {
    if (this.isActiveSource()) {
      this.getPlayer().pause();
    }
  }

  onStartAudio() {
    if (this.isActiveSource()) {
      this.updateButtons(true);
    }
  }

  onPauseAudio() {
    if (this.isActiveSource()) {
      this.updateButtons(false);
    }
  }

  onStartGlobalAudio() {
    this.getPlayer().pause();

    getPlayer().removeEventListener('audio-start', this.onStartGlobalAudio);
  }

  updateButtons(playing) {
    this.playButton.setAttribute('aria-hidden', ariaBoolean(playing));
    this.pauseButton.setAttribute('aria-hidden', ariaBoolean(!playing));

    if (playing) {
      this.playButton.classList.add('d-none');
      this.pauseButton.classList.remove('d-none');
    } else {
      this.playButton.classList.remove('d-none');
      this.pauseButton.classList.add('d-none');
    }
  }
}

class AudioProgressButtonElement extends HTMLAudioAwareElement {
  constructor() {
    super();

    this.onTrackLoaded = this.onTrackLoaded.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  connectedCallback() {
    this.diff = this.dataset.direction === 'forward' ? +this.dataset.seconds : -this.dataset.seconds;

    this.getPlayer().addEventListener('track-loaded', this.onTrackLoaded);
    this.addEventListener('click', this.onClick);

    this.onTrackLoaded();
  }

  disconnectedCallback() {
    this.getPlayer().removeEventListener('track-loaded', this.onTrackLoaded);
    this.removeEventListener('click', this.onClick);
  }

  onTrackLoaded() {
    if (this.isActiveSource()) {
      this.style.display = 'block';
    } else {
      this.style.display = 'none';
    }
  }

  onClick() {
    if (this.isActiveSource()) {
      this.getPlayer().seekTimestamp(this.getPlayer().timestamp + this.diff);
    }
  }
}

class AudioSpeedButtonElement extends HTMLAudioAwareElement {
  constructor() {
    super();

    this.currentSpeed = 0;
    this.speeds = [1, 1.5, 2, 0.75, 1];

    this.onTrackLoaded = this.onTrackLoaded.bind(this);
    this.onAudioSpeedChange = this.onAudioSpeedChange.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  connectedCallback() {
    this.button = this.querySelector('[data-btn]');

    this.getPlayer().addEventListener('track-loaded', this.onTrackLoaded);
    this.getPlayer().addEventListener('audio-speed', this.onAudioSpeedChange);
    this.addEventListener('click', this.onClick);

    this.onTrackLoaded();
  }

  disconnectedCallback() {
    this.getPlayer().removeEventListener('track-loaded', this.onTrackLoaded);
    this.getPlayer().removeEventListener('audio-speed', this.onAudioSpeedChange);
    this.removeEventListener('click', this.onClick);
  }

  onTrackLoaded() {
    if (this.isActiveSource()) {
      this.style.display = 'block';
    } else {
      this.style.display = 'none';
    }
  }

  onAudioSpeedChange(event) {
    this.currentSpeed = this.speeds.indexOf(event.detail.speed);

    this.button.setAttribute('aria-label', 'Set speed to × ' + this.speeds[this.currentSpeed + 1]);
    this.querySelector('[data-speed]').innerHTML = this.speeds[this.currentSpeed];
  }

  onClick() {
    if (this.isActiveSource()) {
      this.getPlayer().setSpeed(this.speeds[this.currentSpeed + 1]);
    }
  }
}

class AudioTimestampButtonElement extends HTMLAudioAwareElement {
  connectedCallback() {
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
  }

  onClick() {
    if (!this.isActiveSource()) {
      this.getSource().initialize();
    }

    this.getPlayer().seekTimestamp(this.dataset.timestamp);

    if (!this.getPlayer().playing) {
      this.getPlayer().play();
    }
  }
}

class AudioProgressBarElement extends HTMLAudioAwareElement {
  constructor() {
    super();

    this.onTrackLoaded = this.onTrackLoaded.bind(this);
    this.onAudioLoaded = this.onAudioLoaded.bind(this);
    this.onAudioStep = this.onAudioStep.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
  }

  connectedCallback() {
    this.progress = this.querySelector('[data-progress]');
    this.duration = this.querySelector('[data-duration]');
    this.seek = this.querySelector('[data-seek]');
    this.progressBar = this.querySelector('[data-progress-bar]');
    this.durationBar = this.querySelector('[data-duration-bar]');
    this.pointer = this.querySelector('[data-pointer]');
    this.playingTitle = this.querySelector('[data-title]');

    this.movingNewTimestamp = 0;

    this.duration.innerHTML = formatTime(this.getPlayer().duration);

    this.getPlayer().addEventListener('track-loaded', this.onTrackLoaded);
    this.getPlayer().addEventListener('audio-loaded', this.onAudioLoaded);

    this.getPlayer().addEventListener('audio-step', this.onAudioStep);
    this.getPlayer().addEventListener('audio-seek', this.onAudioStep);

    this.durationBar.addEventListener('mouseenter', this.onMouseEnter);
    this.durationBar.addEventListener('touchstart', this.onTouchStart);

    this.durationBar.addEventListener('mouseleave', this.onMouseLeave);
    this.durationBar.addEventListener('touchend', this.onTouchEnd);

    this.durationBar.addEventListener('mousemove', this.onMouseMove);
    this.durationBar.addEventListener('touchmove', this.onTouchMove);

    this.durationBar.addEventListener('click', this.onClick);

    this.onTrackLoaded();
  }

  disconnectedCallback() {
    this.getPlayer().removeEventListener('track-loaded', this.onTrackLoaded);
    this.getPlayer().removeEventListener('audio-loaded', this.onAudioLoaded);

    this.getPlayer().removeEventListener('audio-step', this.onAudioStep);
    this.getPlayer().removeEventListener('audio-seek', this.onAudioStep);

    this.durationBar.removeEventListener('mouseenter', this.onMouseEnter);
    this.durationBar.removeEventListener('touchstart', this.onTouchStart);

    this.durationBar.removeEventListener('mouseleave', this.onMouseLeave);
    this.durationBar.removeEventListener('touchend', this.onTouchEnd);

    this.durationBar.removeEventListener('mousemove', this.onMouseMove);
    this.durationBar.removeEventListener('touchmove', this.onMouseLeave);

    this.durationBar.removeEventListener('click', this.onClick);
  }

  onTrackLoaded(event) {
    if (this.playingTitle && event) {
      this.playingTitle.innerHTML = `<a href="${event.detail.playerUrl}">${event.detail.title}</a>`;

      document.querySelector('na-router').updateLinks();
    }

    if (this.isActiveSource()) {
      this.style.display = 'block';
    } else {
      this.style.display = 'none';
    }
  }

  onAudioLoaded() {
    this.duration.innerHTML = formatTime(this.getPlayer().duration);
  }

  onAudioStep(event) {
    const percentage = ((event.detail.timestamp / this.getPlayer().duration) * 100) || 0;

    this.progress.innerHTML = formatTime(event.detail.timestamp);
    this.progressBar.style.width = percentage + '%';
  }

  onClick(event) {
    const durationBarRect = this.durationBar.getBoundingClientRect();

    let distance = event.pageX - durationBarRect.left;
    const percentage = distance / durationBarRect.width;
    let newTimestamp = percentage * this.getPlayer().duration;

    if (newTimestamp < 0) {
      newTimestamp = 0;
    } else if (newTimestamp > this.getPlayer().duration) {
      newTimestamp = this.getPlayer().duration - 1;
    }

    this.getPlayer().seekTimestamp(newTimestamp);
  }

  onInputStart(pageX) {
    this.pointer.classList.remove('d-none');

    this.progress.classList.add('d-none');
    if (this.duration.dataset.duration !== 'keep') {
      this.duration.classList.add('d-none');
    }

    this.querySelectorAll('[data-pointer-hide]').forEach(element => element.classList.add('d-none'));

    this.seek.classList.remove('d-none');

    this.onInputMove(pageX);
  }

  onInputMove(pageX) {
    const durationBarRect = this.durationBar.getBoundingClientRect();

    let distance = pageX - durationBarRect.left;
    const percentage = distance / durationBarRect.width;
    let newTimestamp = percentage * this.getPlayer().duration;

    if (newTimestamp < 0) {
      distance = 1;
      newTimestamp = 0;
    } else if (newTimestamp > this.getPlayer().duration) {
      distance = durationBarRect.width - 1;
      newTimestamp = this.getPlayer().duration;
    }

    this.pointer.style.left = (distance - 1) + 'px';

    this.movingNewTimestamp = newTimestamp;
    this.seek.innerHTML = formatTime(newTimestamp);

    if (!this.seek.hasAttribute('data-still')) {
      const seekRect = this.seek.getBoundingClientRect();
      let seekLeft = distance - (seekRect.width / 2) - 1;
      const maxSeekLeft = durationBarRect.width - seekRect.width;

      if (seekLeft < 0) {
        seekLeft = 0;
      } else if (seekLeft > maxSeekLeft) {
        seekLeft = maxSeekLeft;
      }

      this.seek.style.left = seekLeft + 'px';
    }
  }

  onInputEnd(touch) {
    this.pointer.classList.add('d-none');

    this.progress.classList.remove('d-none');
    if (this.duration.dataset.duration !== 'keep') {
      this.duration.classList.remove('d-none');
    }

    this.querySelectorAll('[data-pointer-hide]').forEach(element => element.classList.remove('d-none'));

    this.seek.classList.add('d-none');

    if (touch) {
      this.getPlayer().seekTimestamp(this.movingNewTimestamp);
    }
  }

  onMouseEnter(event) {
    this.onInputStart(event.pageX);
  }

  onMouseMove(event) {
    this.onInputMove(event.pageX);
  }

  onMouseLeave() {
    this.onInputEnd(false);
  }

  onTouchStart(event) {
    event.preventDefault();

    const touch = event.changedTouches[0];

    this.onInputStart(touch.pageX);
  }

  onTouchMove(event) {
    event.preventDefault();

    const touch = event.changedTouches[0];

    this.onInputMove(touch.pageX);
  }

  onTouchEnd() {
    this.onInputEnd(true);
  }
}

class AudioSourceElement extends HTMLElement {
  connectedCallback() {
    this.clip = typeof this.dataset.clip !== 'undefined';
    this.hash = JSON.stringify([this.dataset.title, this.dataset.src]);

    if (this.dataset.start) {
      window.addEventListener('DOMContentLoaded', () => {
        this.initialize();

        getPlayer().seekTimestamp(this.dataset.start);
      });
    }
  }

  disconnectedCallback() {
    if (this.player) {
      document.body.removeChild(this.player);
    }
  }

  getPlayer() {
    if (this.player) {
      return this.player;
    }

    this.player = new AudioPlayerElement();

    document.body.appendChild(this.player);

    return this.player;
  }

  initialize() {
    const player = this.clip ? this.getPlayer() : getPlayer();

    player.load(this.dataset.src, this.dataset.title, this.hash, document.location.toString(), this.dataset.episode);
  }
}

class AudioToolbarElement extends HTMLElement {
  constructor() {
    super();

    this.onTrackLoaded = this.onTrackLoaded.bind(this);
  }

  connectedCallback() {
    getPlayer().addEventListener('track-loaded', this.onTrackLoaded);
  }

  onTrackLoaded() {
    this.style.display = 'block';
  }
}

class AudioToolbarSpacerElement extends HTMLElement {
  constructor() {
    super();

    this.onTrackLoaded = this.onTrackLoaded.bind(this);
  }

  connectedCallback() {
    if (getPlayer().hash) {
      this.show();
    } else {
      getPlayer().addEventListener('track-loaded', this.onTrackLoaded);
    }
  }

  onTrackLoaded() {
    this.show();
  }

  show() {
    this.style.display = 'block';
  }
}

jQuery(document).ready(() => {
  const player = document.getElementById('audioPlayer');

  if (!player) {
    return;
  }

  const parts = jQuery('.site-episode-part');
  let lastActivePart = null;

  const updateInterface = timestamp => {
    let duration = player.duration;
    let progress = (((timestamp / duration) * 100) || 0) + '%';

    jQuery('[data-player-data="timer"]').text(formatTime(timestamp));
    jQuery('[data-player-data="progress"]').css('width', progress);

    jQuery('[data-player-data="timer-attribute"]').each((index, element) => {
      element = jQuery(element);
      let attribute = element.data('player-attribute');

      if (typeof element.data('original-' + attribute) === 'undefined') {
        element.data('original-' + attribute, element.data(attribute) || element.attr(attribute));
      }

      if (!element.data('original-' + attribute)) {
        return;
      }

      let original = element.data('original-' + attribute);
      element.attr(attribute, original.replace('t=0:00', 't=' + formatTime(timestamp)));
    });

    for (let part of parts) {
      let partTimestamp = jQuery(part).data('timestamp');

      if (partTimestamp <= timestamp) {
        lastActivePart = jQuery(part);
      }
    }

    parts.removeClass('chapter-highlight');
  };

  player.addEventListener('audio-seek', event => updateInterface(event.detail.timestamp));
  player.addEventListener('audio-step', event => updateInterface(event.detail.timestamp));
});

let globalAudioPlayer = false;
export function getPlayer() {
  if (globalAudioPlayer) {
    return globalAudioPlayer;
  }

  globalAudioPlayer = document.getElementById('audioPlayer');

  return globalAudioPlayer;
}

function ariaBoolean(value) {
  return value ? 'true' : 'false';
}

export function formatTime(value) {
  let hours = Math.floor(value / 60 / 60) || 0;
  let minutes = Math.floor((value - (hours * 60 * 60)) / 60) || 0;
  let seconds = (value - (minutes * 60) - (hours * 60 * 60)) || 0;

  if (hours > 0) {
    return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + Math.trunc(seconds);
  }

  return minutes + ':' + (seconds < 10 ? '0' : '') + Math.trunc(seconds);
}

export function serializeTime(value) {
  let values = value.split(':');

  if (values.length > 2) {
    return (+values[0]) * 60 * 60 + (+values[1]) * 60 + (+values[2]);
  } else if (values.length === 2) {
    return (+values[0]) * 60 + (+values[1]);
  }

  return +values[0];
}

window.customElements.define('na-audio', AudioPlayerElement);
window.customElements.define('na-audio-source', AudioSourceElement);
window.customElements.define('na-audio-play', AudioPlayButtonElement);
window.customElements.define('na-audio-seek', AudioProgressButtonElement);
window.customElements.define('na-audio-speed', AudioSpeedButtonElement);
window.customElements.define('na-audio-timestamp', AudioTimestampButtonElement);
window.customElements.define('na-audio-progress', AudioProgressBarElement);
window.customElements.define('na-audio-toolbar', AudioToolbarElement);
window.customElements.define('na-audio-toolbar-spacer', AudioToolbarSpacerElement);
