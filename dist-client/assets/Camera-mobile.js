(() => {
  // client-pixi/Camera.ts
  var MAP_WIDTH = 100;
  var MAP_HEIGHT = 50;
  var TILE_SIZE = 64;
  var Camera = class {
    constructor(target, canvas) {
      this.scale = 1;
      // 3档缩放 - 与单机版一致
      this.zoomLevel = "NORMAL";
      this.ZOOM_LEVELS = {
        "FAR": 0.25,
        "NORMAL": 1,
        "CLOSE": 4
      };
      // ===== 鼠标拖动 =====
      this.isDragging = false;
      this.lastX = 0;
      this.lastY = 0;
      // ===== 移动端触摸 =====
      this.isTouchDragging = false;
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.lastTouchX = 0;
      this.lastTouchY = 0;
      // ===== 双指缩放 =====
      this.isPinching = false;
      this.lastPinchDistance = 0;
      this.lastPinchCenterX = 0;
      this.lastPinchCenterY = 0;
      // ===== 双击检测 =====
      this.lastTapTime = 0;
      this.lastTapX = 0;
      this.lastTapY = 0;
      this.DOUBLE_TAP_DELAY = 300;
      // 双击判定时间(ms)
      this.DOUBLE_TAP_DISTANCE = 30;
      // 双击判定距离(px)
      // ===== 缩放限制 =====
      this.MIN_ZOOM = 0.15;
      this.MAX_ZOOM = 6;
      this.target = target;
      this.setupControls(canvas);
    }
    setupControls(canvas) {
      canvas.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          this.isDragging = true;
          this.lastX = e.clientX;
          this.lastY = e.clientY;
          canvas.style.cursor = "grabbing";
        }
      });
      window.addEventListener("mouseup", () => {
        this.isDragging = false;
        canvas.style.cursor = "grab";
      });
      window.addEventListener("mousemove", (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.target.x += dx;
        this.target.y += dy;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn(e.clientX, e.clientY);
        } else {
          this.zoomOut(e.clientX, e.clientY);
        }
      });
      canvas.addEventListener("dblclick", () => {
        this.reset();
      });
      canvas.style.cursor = "grab";
      canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          this.isTouchDragging = true;
          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
          this.lastTouchX = touch.clientX;
          this.lastTouchY = touch.clientY;
          const now = Date.now();
          const dx = touch.clientX - this.lastTapX;
          const dy = touch.clientY - this.lastTapY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (now - this.lastTapTime < this.DOUBLE_TAP_DELAY && distance < this.DOUBLE_TAP_DISTANCE) {
            this.reset();
            this.lastTapTime = 0;
          } else {
            this.lastTapTime = now;
            this.lastTapX = touch.clientX;
            this.lastTapY = touch.clientY;
          }
        } else if (e.touches.length === 2) {
          this.isTouchDragging = false;
          this.isPinching = true;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const dx = touch2.clientX - touch1.clientX;
          const dy = touch2.clientY - touch1.clientY;
          this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
          this.lastPinchCenterX = (touch1.clientX + touch2.clientX) / 2;
          this.lastPinchCenterY = (touch1.clientY + touch2.clientY) / 2;
        }
      }, { passive: false });
      canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && this.isTouchDragging) {
          const touch = e.touches[0];
          const dx = touch.clientX - this.lastTouchX;
          const dy = touch.clientY - this.lastTouchY;
          this.target.x += dx;
          this.target.y += dy;
          this.lastTouchX = touch.clientX;
          this.lastTouchY = touch.clientY;
        } else if (e.touches.length === 2 && this.isPinching) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const dx = touch2.clientX - touch1.clientX;
          const dy = touch2.clientY - touch1.clientY;
          const currentDistance = Math.sqrt(dx * dx + dy * dy);
          const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
          const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
          const scaleChange = currentDistance / this.lastPinchDistance;
          const newScale = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.scale * scaleChange));
          if (newScale !== this.scale) {
            const worldX = (currentCenterX - this.target.x) / this.scale;
            const worldY = (currentCenterY - this.target.y) / this.scale;
            this.target.scale.set(newScale);
            this.scale = newScale;
            this.target.x = currentCenterX - worldX * newScale;
            this.target.y = currentCenterY - worldY * newScale;
            this.clamp();
          }
          this.lastPinchDistance = currentDistance;
          this.lastPinchCenterX = currentCenterX;
          this.lastPinchCenterY = currentCenterY;
        }
      }, { passive: false });
      canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        if (e.touches.length === 0) {
          this.isTouchDragging = false;
          this.isPinching = false;
        } else if (e.touches.length === 1) {
          this.isPinching = false;
          this.isTouchDragging = true;
          const touch = e.touches[0];
          this.lastTouchX = touch.clientX;
          this.lastTouchY = touch.clientY;
        }
      }, { passive: false });
      document.body.addEventListener("touchmove", (e) => {
        if (e.target === canvas) {
          e.preventDefault();
        }
      }, { passive: false });
    }
    zoomIn(mouseX, mouseY) {
      if (this.zoomLevel === "FAR") {
        this.setZoom("NORMAL", mouseX, mouseY);
      } else if (this.zoomLevel === "NORMAL") {
        this.setZoom("CLOSE", mouseX, mouseY);
      }
    }
    zoomOut(mouseX, mouseY) {
      if (this.zoomLevel === "CLOSE") {
        this.setZoom("NORMAL", mouseX, mouseY);
      } else if (this.zoomLevel === "NORMAL") {
        this.setZoom("FAR", mouseX, mouseY);
      }
    }
    setZoom(level, mouseX, mouseY) {
      const oldZoom = this.scale;
      const newZoom = this.ZOOM_LEVELS[level];
      if (mouseX !== void 0 && mouseY !== void 0) {
        const worldX = (mouseX - this.target.x) / oldZoom;
        const worldY = (mouseY - this.target.y) / oldZoom;
        this.zoomLevel = level;
        this.target.scale.set(newZoom);
        this.scale = newZoom;
        this.target.x = mouseX - worldX * newZoom;
        this.target.y = mouseY - worldY * newZoom;
      } else {
        this.zoomLevel = level;
        this.target.scale.set(newZoom);
        this.scale = newZoom;
      }
      this.clamp();
    }
    reset() {
      this.setZoom("NORMAL");
      const centerX = 100 * TILE_SIZE;
      const centerY = 50 * TILE_SIZE;
      this.target.x = window.innerWidth / 2 - centerX;
      this.target.y = window.innerHeight / 2 - centerY;
    }
    clamp() {
      const canvasWidth = window.innerWidth;
      const canvasHeight = window.innerHeight;
      const worldWidth = MAP_WIDTH * TILE_SIZE * this.scale;
      const worldHeight = MAP_HEIGHT * TILE_SIZE * this.scale;
      if (worldWidth <= canvasWidth) {
        this.target.x = (canvasWidth - worldWidth) / 2;
      } else {
        this.target.x = Math.max(canvasWidth - worldWidth, Math.min(0, this.target.x));
      }
      if (worldHeight <= canvasHeight) {
        this.target.y = (canvasHeight - worldHeight) / 2;
      } else {
        this.target.y = Math.max(canvasHeight - worldHeight, Math.min(0, this.target.y));
      }
    }
    getZoomLevel() {
      return this.zoomLevel;
    }
  };
})();
