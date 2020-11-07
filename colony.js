class Colony {
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
    this.board.initialize(tile_count_x, tile_count_y);
    this.ants = [];
    let offset = parseInt(Math.random() * 360);
    for (let i = 0; i < this.controls.config.ants; i++) {
      let x = parseInt(this.board.size.x * (i+1) / (this.controls.config.ants+1));
      let id = parseInt(offset + 360 * i / this.controls.config.ants) % 360;
      this.ants.push(
        new Ant(this, tile_count_y / 2, x, id)
      );
    };
    this.resume();
  }

  update() {
    // Each ant evaluates the board under their tile, changes its state, and updates their position/direction
    for (let ant of this.ants) {
      let position = ant.getPosition();
      ant.process(this.board);
      this.board.updateCellState(position, ant.id);
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
          shift: 0,
          dirty: true,
          last_ant: null,
        };
      }
    }
  }

  updateCellState(position, last_ant) {
    let row = position[1], col = position[0];
    this.grid[row][col].state++;
    if (this.grid[row][col].state > this.scope.controls.config.instructions) {
      this.grid[row][col].state %= this.scope.controls.config.instructions;
      this.grid[row][col].shift++;
    }
    this.grid[row][col].dirty = true;
    this.grid[row][col].last_ant = last_ant;
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
        if (this.grid[row][col].last_ant == null) {
          ctx.fillStyle = "black";
        } else {
          if (this.grid[row][col].shift > 0) {
            let hue =
            ctx.fillStyle = `hsl(${this.grid[row][col].last_ant + (this.grid[row][col].shift-1)*50+this.grid[row][col].state}, 100%, 50%)`
          } else {
            ctx.fillStyle = `hsl(${this.grid[row][col].last_ant}, 100%, ${this.grid[row][col].state}%)`;
          }
        }
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
      ant_count: "#ant_count"
    };

    this.config = {
      path: [],
      tile_size: 5,
      extended: false,
    }
    for (const [key, value] of Object.entries(config)) {
      this.config[key] = value;
    }
    document.querySelector(this.selector.reload).addEventListener("click", this.scope.reset.bind(this.scope));
    document.querySelector(this.selector.playback_pause).addEventListener("click", this.scope.pause.bind(this.scope));
    document.querySelector(this.selector.playback_play).addEventListener("click", this.scope.resume.bind(this.scope));
    document.querySelector(this.selector.playback_step).addEventListener("click", this.scope.iterate.bind(this.scope));
  }

  initialize() {
    this.config.ants = parseInt(document.querySelector(this.selector.ant_count).value);
  }

  generatePath() {
    let path = [];
    let path_options;
    if (document.querySelector("#enable_extended").checked) {
      path_options = ["left", "right", "north", "south", "east", "west", "forward", "reverse"];
    } else {
      path_options = ["left", "right"];
    }
    for (let i = 0; i < this.config.instructions; i++) {
      path.push(path_options[parseInt(Math.random() * path_options.length)]);
    }
    return path;
  }
}

class Ant {
  constructor(scope, x, y, id) {
    this.id = id;
    this.position = [ y, x ];
    this.steps = 0;
    /*
    Current facing direction, clockwise from cardinal north.
    */
    this.direction = parseInt(Math.random() * 4);
    this.scope = scope;
    this.path = this.scope.controls.generatePath();
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
    switch (this.path[current_state]) {
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
    return;
  }

  getPosition() {
    return this.position;
  }
}
