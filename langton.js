class Langton {
  constructor(config) {
    this.state = {
      current: 0,
      running: 1,
      pause: 0,
      matrix: 2,
    };
    this.ui = {
      last_render: 0,
      update_speed: 0,
      has_initialized: false,
    };
    this.selector = {
      canvas: "viewport",
      button: "#reload_controls",
    };

    this.controls = new Controls(this, config);
    this.board = new Board(this);
    this.reset();
    this.loop(0);
    this.draw();
  }

  reset() {
    // Reload controls from form
    // Reset Board
    // Reset Ants
    // Start
    this.controls.initialize();
    let tile_count_x = this.controls.config.width / this.controls.config.tile_size;
    let tile_count_y = this.controls.config.height / this.controls.config.tile_size;
    this.board.initialize(tile_count_x, tile_count_y, this.controls.getPath());
    this.ants = [ new Ant(tile_count_y / 2, tile_count_x / 2, this.controls.getPath()) ];
    this.resume();
  }

  update() {
    // Each ant evaluates the board under their tile, changes its state, and updates their position/direction
    for (let ant of this.ants) {
      let position = ant.getPosition();
      ant.process(this.board);
      this.board.updateCellState(position);
    }
  }

  draw() {
    this.board.draw();
    for (let ant of this.ants) {
      ant.draw();
    }
  }

  resume() {
    this.state.current = this.state.running;
  }

  pause() {
    this.state.current = this.state.pause;
  }

  iterate() {
    for (let i = 0; i < this.controls.config.steps_per_draw; i++) {
      this.update();
    }
    this.draw();
  }

  loop(ts) {
    let progress = ts - this.ui.last_render;
    if (this.state.current != this.state.pause && progress >= this.ui.update_speed) {
      this.iterate();
      this.ui.last_render = ts;
    }
    // RequestAnimationFrame starts its own process each time reset is invoked
    window.requestAnimationFrame(this.loop.bind(this));
  }
}

class Board {
  constructor(scope) {
    this.scope = scope;
    this.selector = {
      canvas: "viewport",
      button: "#reload_controls",
    };
  }

  initialize(x, y, states) {
    this.size = {
      x: x,
      y: y,
    };
    this.tile_size = this.scope.controls.config.tile_size;
    this.states = states;
    this.grid = new Array(this.size.x);
    for (let row = 0; row < this.size.y; row++) {
      this.grid[row] = new Array(this.size.x);
      for (let col = 0; col < this.size.x; col++) {
        this.grid[row][col] = {
          state: 0,
          dirty: true,
        };
      }
    }
    this.generatePalette(states.length);
  }

  generatePalette(count) {
    this.palette = [];
    if (count <= 2) {
      this.palette = ["#ffffff", "#000000"];
      return;
    }
    if (this.scope.controls.config.colors == "random") {
      for (let i = 0; i < count; i++) {
        let lightness = parseInt(Math.random() * 50) + 20;
        let hue = parseInt(Math.random() * 360);
        this.palette.push(`hsl(${hue}, 100%, ${lightness}%)`);
      }
      return;
    }
    if (this.scope.controls.config.colors == "hsl_gradient") {
      this.palette.push("#000000");
      let offset = parseInt(Math.random() * 360);
      for (let i = 1; i < count; i++) {
        let hue = parseInt(360 * (i / 4096)) + offset % 360;
        let lightness = 40 + parseInt(20 * Math.sin(i / 6.28));
        this.palette.push(`hsl(${hue}, 100%, ${lightness}%)`);
      }
      return;
    }
    for (let i = 0; i < count; i++) {
      let g = (i) % 256;
      let r = (i / 16) % 256;
      let b = (i / 4) % 256;
      this.palette.push(`rgb(${r}, ${g}, ${b})`);
    }
  }

  updateCellState(position) {
    let row = position[1], col = position[0];
    this.grid[row][col].state++;
    this.grid[row][col].state %= this.states.length;
    this.grid[row][col].dirty = true;
  }

  // TODO Instruction-based color scale
  getColor(state) {
    return this.palette[state];
  }

  draw() {
    let c = document.getElementById(this.selector.canvas);
    let ctx = c.getContext("2d");
    for (let row = 0; row < this.size.y; row++) {
      for (let col = 0; col < this.size.x; col++) {
        if (!this.grid[row][col].dirty) { continue; }
        ctx.fillStyle = this.getColor(this.grid[row][col].state);
        ctx.fillRect(col*this.tile_size, row*this.tile_size, this.tile_size, this.tile_size);
        this.grid[row][col].dirty = false;
      }
    }
  }
}

/*
Interacts with inputs on page
*/
class Controls {
  constructor(scope, config) {
    this.scope = scope;
    this.selector = {
      canvas: "viewport",
      reload: "#reload_controls",
      path_list: "#path",
      path_new: "#path_new",
      playback_pause: "#playback_pause",
      playback_step: "#playback_step",
      playback_play: "#playback_play",
    };

    this.config = {
      path: [],
      tile_size: 5,
      extended: false,
    }
    for (const [key, value] of Object.entries(config)) {
      this.config[key] = value;
    }
    if (this.config.instruction_type == "user") {
      for (let i of this.config.default) {
        this.addPathSelect(i);
      }
    }
    document.querySelector(this.selector.reload).addEventListener("click", this.scope.reset.bind(this.scope));
    document.querySelector(this.selector.playback_pause).addEventListener("click", this.scope.pause.bind(this.scope));
    document.querySelector(this.selector.playback_play).addEventListener("click", this.scope.resume.bind(this.scope));
    document.querySelector(this.selector.playback_step).addEventListener("click", this.scope.iterate.bind(this.scope));
    if (this.config.instruction_type == "user") {
      document.querySelector(this.selector.path_new).addEventListener("click", this.addPathSelect.bind(this));
      // - Remove entry TODO
      document.querySelector(this.selector.path_list).addEventListener("change", (e) => {
        if (e.target && e.target.value == "remove") {
          e.target.parentElement.remove();
        }
      });
    }
  }

  initialize() {
    // Load path keys into path
    this.config.path = [];
    if (this.config.instruction_type == "user") {
      document.querySelectorAll("#path select").forEach(el => {
        this.config.path.push(el.value);
      });
    } else if (this.config.instruction_type == "random") {
      let path_options;
      if (document.querySelector("#enable_extended").checked) {
        path_options = ["left", "right", "north", "south", "east", "west", "forward", "reverse"];
      } else {
        path_options = ["left", "right"];
      }
      for (let i = 0; i < this.config.instructions; i++) {
        this.config.path.push(path_options[parseInt(Math.random() * path_options.length)]);
      }
    }
  }

  getPath() {
    return this.config.path;
  }

  addPathSelect(set_value) {
    if (typeof set_value == "undefined") { set_value = "left" };
    const directions = {
      "left": "Left",
      "right": "Right",
      "north": "North",
      "east": "East",
      "south": "South",
      "west": "West",
      "forward": "Forward",
      "reverse": "Reverse",
      "remove": "X",
    };
    let option_markup = "";
    for (const [key, value] of Object.entries(directions)) {
      const selected = (key == set_value) ? "selected" : "";
      option_markup += `<option value='${key}' ${selected}>${value}</option>`;
    }
    const markup = `<li class='path_step'><select>${option_markup}</select></li>`;
    document.querySelector(this.selector.path_list).insertAdjacentHTML('beforeend', markup);
  }
}

class Ant {
  constructor(x, y, controls) {
    this.selector = {
      canvas: "viewport",
      controls: "#controls",
      button: "#reload_controls",
    };
    this.position = [ y, x ];
    this.steps = 0;
    /*
    Current facing direction, clockwise from cardinal north.
    */
    this.direction = 3;
    this.controls = controls;
  }

  step(board) {
    this.steps++;
    this.direction += 4;
    this.direction %= 4;
    switch (this.direction) {
      case 0: this.position[1]--; break;
      case 1: this.position[0]++; break;
      case 2: this.position[1]++; break;
      case 3: this.position[0]--; break;
    }
    this.position[1] += board.size.y;
    this.position[1] %= board.size.y;
    this.position[0] += board.size.x;
    this.position[0] %= board.size.x;
  }

  process(board) {
    this.step(board);
    let row = this.position[1];
    let col = this.position[0];
    let current_state = board.grid[row][col].state;
    switch (this.controls[current_state]) {
      case "left":
        this.direction--; break;
      case "right":
        this.direction++; break;
      case "north":
        this.direction = 0; break;
      case "east":
        this.direction = 1; break;
      case "south":
        this.direction = 2; break;
      case "west":
        this.direction = 3; break;
      case "forward":
        break;
      case "reverse":
        this.direction += 2; break;
    }
  }

  draw() {
    return; // TODO;
    let c = document.getElementById(this.selector.canvas);
    let ctx = c.getContext("2d");
    ctx.fillStyle = "#21bb21";
    //ctx.arc()
  }

  getPosition() {
    return this.position;
  }
}
