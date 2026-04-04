/**
 * VideoPlayer Component for SpiritCore
 * Provides a reusable, accessible video player with controls for intro videos
 */

class VideoPlayer {
  constructor(options = {}) {
    this.videoPath = options.videoPath || '';
    this.autoplay = options.autoplay !== false;
    this.muted = options.muted !== false;
    this.loop = options.loop === true;
    this.onEnded = options.onEnded || (() => {});
    this.onPlay = options.onPlay || (() => {});
    this.onPause = options.onPause || (() => {});
    this.containerClass = options.containerClass || 'video-player-container';
    this.showControls = options.showControls !== false;
    this.showFullscreen = options.showFullscreen !== false;
    this.playbackRate = options.playbackRate || 1;
    
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.videoElement = null;
    this.containerElement = null;
  }

  /**
   * Render the video player HTML
   */
  render() {
    return `
      <div class="${this.containerClass}">
        <div class="video-player-wrapper">
          <video
            class="video-player-element"
            ${this.autoplay ? 'autoplay' : ''}
            ${this.muted ? 'muted' : ''}
            ${this.loop ? 'loop' : ''}
            playsinline
            preload="metadata"
          >
            <source src="${this.videoPath}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
          
          ${this.showControls ? this.renderControls() : ''}
          
          <div class="video-player-overlay"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render video controls
   */
  renderControls() {
    return `
      <div class="video-player-controls">
        <div class="video-player-progress">
          <div class="video-player-progress-bar">
            <div class="video-player-progress-fill"></div>
            <div class="video-player-progress-handle"></div>
          </div>
          <div class="video-player-time">
            <span class="video-player-current-time">0:00</span>
            <span class="video-player-duration">0:00</span>
          </div>
        </div>
        
        <div class="video-player-buttons">
          <button class="video-player-btn video-player-play-btn" aria-label="Play/Pause">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          
          <button class="video-player-btn video-player-volume-btn" aria-label="Mute/Unmute">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.26 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
          
          ${this.showFullscreen ? `
            <button class="video-player-btn video-player-fullscreen-btn" aria-label="Fullscreen">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Initialize the video player after DOM is ready
   */
  init(containerElement) {
    this.containerElement = containerElement;
    this.videoElement = containerElement.querySelector('.video-player-element');
    
    if (!this.videoElement) {
      console.error('VideoPlayer: Video element not found');
      return;
    }

    // Set playback rate
    this.videoElement.playbackRate = this.playbackRate;

    // Add event listeners
    this.videoElement.addEventListener('play', () => this.handlePlay());
    this.videoElement.addEventListener('pause', () => this.handlePause());
    this.videoElement.addEventListener('ended', () => this.handleEnded());
    this.videoElement.addEventListener('timeupdate', () => this.handleTimeUpdate());
    this.videoElement.addEventListener('loadedmetadata', () => this.handleLoadedMetadata());

    // Attach control listeners if controls are shown
    if (this.showControls) {
      this.attachControlListeners();
    }
  }

  /**
   * Attach event listeners to control buttons
   */
  attachControlListeners() {
    const playBtn = this.containerElement.querySelector('.video-player-play-btn');
    const volumeBtn = this.containerElement.querySelector('.video-player-volume-btn');
    const fullscreenBtn = this.containerElement.querySelector('.video-player-fullscreen-btn');
    const progressBar = this.containerElement.querySelector('.video-player-progress-bar');

    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlay());
    }

    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => this.toggleMute());
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => this.enterFullscreen());
    }

    if (progressBar) {
      progressBar.addEventListener('click', (e) => this.handleProgressClick(e));
    }
  }

  /**
   * Handle play event
   */
  handlePlay() {
    this.isPlaying = true;
    this.updatePlayButton();
    this.onPlay();
  }

  /**
   * Handle pause event
   */
  handlePause() {
    this.isPlaying = false;
    this.updatePlayButton();
    this.onPause();
  }

  /**
   * Handle ended event
   */
  handleEnded() {
    this.isPlaying = false;
    this.updatePlayButton();
    this.onEnded();
  }

  /**
   * Handle time update
   */
  handleTimeUpdate() {
    this.currentTime = this.videoElement.currentTime;
    this.updateProgress();
  }

  /**
   * Handle loaded metadata
   */
  handleLoadedMetadata() {
    this.duration = this.videoElement.duration;
    this.updateDuration();
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.videoElement.pause();
    } else {
      this.videoElement.play();
    }
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.videoElement.muted = !this.videoElement.muted;
    this.updateVolumeButton();
  }

  /**
   * Enter fullscreen
   */
  enterFullscreen() {
    if (this.videoElement.requestFullscreen) {
      this.videoElement.requestFullscreen();
    } else if (this.videoElement.webkitRequestFullscreen) {
      this.videoElement.webkitRequestFullscreen();
    }
  }

  /**
   * Handle progress bar click
   */
  handleProgressClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    this.videoElement.currentTime = percent * this.duration;
  }

  /**
   * Update play button state
   */
  updatePlayButton() {
    const playBtn = this.containerElement.querySelector('.video-player-play-btn');
    if (playBtn) {
      if (this.isPlaying) {
        playBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        `;
        playBtn.setAttribute('aria-label', 'Pause');
      } else {
        playBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
        playBtn.setAttribute('aria-label', 'Play');
      }
    }
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    const progressFill = this.containerElement.querySelector('.video-player-progress-fill');
    const currentTimeEl = this.containerElement.querySelector('.video-player-current-time');
    
    if (progressFill && this.duration > 0) {
      const percent = (this.currentTime / this.duration) * 100;
      progressFill.style.width = `${percent}%`;
    }
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.currentTime);
    }
  }

  /**
   * Update duration display
   */
  updateDuration() {
    const durationEl = this.containerElement.querySelector('.video-player-duration');
    if (durationEl) {
      durationEl.textContent = this.formatTime(this.duration);
    }
  }

  /**
   * Update volume button state
   */
  updateVolumeButton() {
    const volumeBtn = this.containerElement.querySelector('.video-player-volume-btn');
    if (volumeBtn) {
      if (this.videoElement.muted) {
        volumeBtn.classList.add('muted');
      } else {
        volumeBtn.classList.remove('muted');
      }
    }
  }

  /**
   * Format time in MM:SS format
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Play the video
   */
  play() {
    this.videoElement.play();
  }

  /**
   * Pause the video
   */
  pause() {
    this.videoElement.pause();
  }

  /**
   * Set current time
   */
  setCurrentTime(time) {
    this.videoElement.currentTime = time;
  }

  /**
   * Destroy the player
   */
  destroy() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.removeAttribute('src');
    }
    this.videoElement = null;
    this.containerElement = null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoPlayer;
}
