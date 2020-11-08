const weighted_random = (options) => {
  let total = 0;
  for (const [key, weight] of Object.entries(options)) {
    total += weight;
  }
  let selection = Math.random() * total;
  for (const [key, weight] of Object.entries(options)) {
    if (selection < weight) {
      return key;
    }
    selection -= weight;
  }
}

class Config {
  constructor(scope, options) {
    this.scope = scope;
    this.selector = {
      canvas: "viewport",
      debug: "debug",
    };
    this.instruction_sets = {
      "square": {
        "basic": ["left", "right"],
        "extended": ["left", "right", "north", "south", "east", "west", "forward", "reverse"],
      },
      "hex": {
        "basic": ["left", "right", "left2", "right2"],
        "extended": ["left", "right", "left2", "right2", "forward", "reverse", "northeast", "east", "southeast", "southwest", "west", "northwest"],
      },
    };
    this.default_options = options;
  }

  initialize() {
    // 1 to ...5? Maybe a binomial
    this.ant_count = parseInt(weighted_random({
      1: 15,
      2: 20,
      3: 58,
      4: 5,
      5: 2,
    }));
    this.instruction_count = parseInt(weighted_random({
      1: 1,
      5: 1,
      10: 2,
      100: 1,
      500: 0.5,
      1000: 0.1,
    }));
    this.instruction_count *= parseInt(Math.random() * 10 + 1);
    /*
    square: Square tiles on a grid, granular to 1 pixel/tile
    hex: Still need to iron out logic/drawing
    */
    this.board_style = weighted_random({
      "square": 3,
      "hex": 1,
    });
    if (this.board_style == "square") {
      this.tile_size = parseInt(weighted_random({
        1: 90,
        2: 10,
      }));
      this.draw_style = "square";
    } else {
      this.tile_size = parseInt(weighted_random({
        2: 40,
        4: 30,
        5: 10,
        6: 10,
        7: 5,
        8: 5,
      }));
      this.draw_style = weighted_random({
        "square": this.tile_size > 2 ? 25 : 100,
        "hex_flat": this.tile_size > 2 ? 75 : 0,
        "hex_depth": this.tile_size > 2 ? 25 : 0,
      });
    }
    if (this.tile_size > 1) {
      this.offset = this.board_style == "hex" || Math.random() > 0.95;
    }
    this.steps_per_draw = 1000 / Math.pow(this.tile_size, 2);
    this.direction_count = this.board_style == "square" ? 4 : 6;

    /*
    basic: Only LR (L2 R2 in Hex)
    extended: LR NSEW FU
    */
    this.instruction_type = weighted_random({
      "basic": 30,
      "extended": 70,
    });

    /*
    constant: Each option has the same weight
    random: Each option has a random weight
    direction_priority: Left* and Right* add a second weight
    cardinal_priority: NSEW add a second weight
    */
    this.instruction_weight = weighted_random({
      "constant": 1,
      "random": 1,
      "direction_priority": 0.5,
      "cardinal_priority": 0.3,
    });

    /*
    spaced: space-between
    static: middle of the screen
    random: Anywhere in bounds
    */
    this.ant_position_x = weighted_random({
      "spaced": 70,
      "static": 10,
      "random": 20,
    });
    this.ant_position_y = weighted_random({
      "spaced": 70,
      "static": this.ant_position_x == "static" ? 0.1 : 10,
      "random": 20,
    });

    /*
    random: Any color is available; stored as a palette in Board
    rgb_blend: Board has three sets of states that interact independently, named r/g/b
    hue: Source color system (kinda needs 4096 colors, though)
    hsl: Each ant has an ID 1-360 (Hue spectrum) that sets board tile.last_ant, scaling lightness
    hsl_grade: Each ant has an ID 1-360, hue modified by state
    hsl_shift: hsl, but on max_state+1 increases hue rather than resets lightness, circling spectrum
    */
    this.ant_coloring = weighted_random({
      "random": 15,
      "rgb_blend": this.instruction_count > 500 ? 1 : 10,
      "hsl": this.instruction_count > 300 ? 5 : 25,
      "hsl_grade": 25,
      "hsl_shift": 25,
    });
    this.color_cycle = 360;

    // Override for all default options
    for (const [option, value] of Object.entries(this.default_options)) {
      this[option] = value;
    }
    // After all values are set, handle overrides caused by color systems
    if (this.ant_coloring == "rgb_blend") {
      this.ant_count = 3;
    } else if (this.ant_coloring == "random") {
      this.color_data = {
        min: 20, // Anything, really
        range: 50, // final would be 20 + Math.random() * 50
        saturation: 100, // Grayscale works, too
      }
    } else if (["hsl", "hsl_grade", "hsl_shift"].indexOf(this.ant_coloring) != -1) {
      // Multiples of 1-5 are valid
      this.color_cycle = parseInt(weighted_random({
        360: 45,
        300: 10,
        240: 25,
        180: 5,
        120: 10,
        60: 5,
      }))
    }
  }

  generateInstructions(count) {
    // TODO Allow for other methods of generation
    const instruction_pool = this.instruction_sets[this.board_style][this.instruction_type];
    const instruction_weights = {};
    for (const instruction of instruction_pool) {
      if (this.instruction_weight == "constant") {
        instruction_weights[instruction] = 1;
      } else if (this.instruction_weight == "random") {
        instruction_weights[instruction] = Math.random();
      } else if (this.instruction_weight == "direction_priority") {
        instruction_weights[instruction] = Math.random();
        if (["left", "right", "left2", "right2"].indexOf(instruction) != -1) {
          instruction_weights[instruction] += Math.random();
        }
      } else if (this.instruction_weight == "cardinal_priority") {
        instruction_weights[instruction] = Math.random();
        if (["north", "south", "east", "west"].indexOf(instruction) != -1) {
          instruction_weights[instruction] += Math.random();
        }
      }
    }
    const instructions = [];

    for (let i = 0; i < this.instruction_count; i++) {
      instructions.push(weighted_random(instruction_weights));
    }
    // Final cleanup to avoid two-instruction duplicates
    if (instructions.length == 2 && instructions[0] == instructions[1]) {
      delete instruction_weights[instructions[1]];
      instructions[1] = weighted_random(instruction_weights);
    }
    return instructions;
  }

  toString() {
    return [
      `ants: ${this.ant_count}`,
      `style: ${this.board_style}`,
      `instructions: ${this.instruction_type}`,
      `coloring: ${this.ant_coloring}`,
      `draw: ${this.draw_style}`,
    ];
  }
}

// A world is comprised of the rules, setting, and all inhabitants
class World {
  constructor(options) {
    this.state = {
      current: 0,
      pause: 0,
      running: 1,
      reset: 2,
    };
    this.ui = {
      last_render: 0,
      update_speed: 60,
      has_initialized: false,
      reset_time: options.reset_time,
      time_active: 0,
    };
    this.width = document.body.clientWidth;
    this.height = document.body.clientHeight;

    this.config = new Config(this, options);
    const canvas = document.getElementById(this.config.selector.canvas);
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    this.board = new Board(this);
    this.screen_cleaner = new ScreenCleaner(this);

    this.reset();
    this.loop(0);
    this.draw();
  }

  reset() {
    this.pause();
    this.config.initialize();
    // Set board width and height based on window size and pixel size, I guess?
    this.board.initialize();
    this.ui.time_active = 0;
    this.createAnts();
    // Create ants
    this.resume();
  }

  createAnts() {
    this.ants = [];
    // TODO Color base when hsl
    let offset = parseInt(Math.random() * 360);
    for (let i = 0; i < this.config.ant_count; i++) {
      let id = parseInt(offset + this.config.color_cycle * i / this.config.ant_count) % 360;
      if (this.config.ant_coloring == "rgb_blend") {
        id = ["r", "g", "b"][i];
      }
      let position = {
        x: 0,
        y: 0,
      };
      switch (this.config.ant_position_x) {
        case "random": position.x = parseInt(Math.random() * this.board.size.x); break;
        case "static": position.x = parseInt(this.board.size.x / 2); break;
        case "spaced": position.x = parseInt(this.board.size.x * (i + 1) / (this.config.ant_count + 1)); break;
      }
      switch (this.config.ant_position_y) {
        case "random": position.y = parseInt(Math.random() * this.board.size.y); break;
        case "static": position.y = parseInt(this.board.size.y / 2); break;
        case "spaced": position.y = parseInt(this.board.size.y * (i + 1) / (this.config.ant_count + 1)); break;
      }
      let ant = new Ant(this, id);
      ant.setPosition(position);
      this.ants.push(ant);
    }
  }

  update() {
    for (let ant of this.ants) {
      let position = ant.getPosition();
      ant.process();
      this.board.updateCellState(position, ant.id);
    }
  }

  debug() {
    const canvas = document.getElementById(this.config.selector.debug);
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, this.width, this.height);
    context.font = "8px Courier";
    context.fillStyle = "white";
    for (const [index, value] of Object.entries(this.config.toString())) {
      context.fillText(value, 1, 5+index*6);
    }
  }

  draw() {
    this.config.debug && this.debug();
    const canvas = document.getElementById(this.config.selector.canvas);
    const context = canvas.getContext("2d");
    this.state.current == this.state.reset && this.screen_cleaner.draw(context);
    this.state.current == this.state.running && this.board.draw(context);
  }

  pause() {
    this.state.current = this.state.pause;
  }

  resume() {
    this.state.current = this.state.running;
  }

  iterate() {
    for (let i = 0; i < this.config.steps_per_draw; i++) {
      this.update();
    }
    this.draw();
  }

  updateReset() {
    this.screen_cleaner.update();
    this.draw();
    if (this.screen_cleaner.state.current == this.screen_cleaner.state.done) {
      this.screen_cleaner.done();
      this.reset();
    }
  }

  loop(ts) {
    let progress = ts - this.ui.last_render;
    if (progress < this.ui.update_speed) {
      window.requestAnimationFrame(this.loop.bind(this));
      return;
    }
    this.ui.last_render = ts;
    if (this.state.current == this.state.running) {
      this.iterate();
      this.ui.time_active += progress;
      if (this.ui.time_active >= this.ui.reset_time) {
        this.state.current = this.state.reset;
        this.screen_cleaner.start();
      }
    } else if (this.state.current == this.state.reset) {
      this.updateReset();
    }
    window.requestAnimationFrame(this.loop.bind(this));
  }

  getClampedDirection(ant_instance) {
    ant_instance.direction += this.config.direction_count;
    ant_instance.direction %= this.config.direction_count;
    return ant_instance.direction;
  }

  getClampedPosition(ant_instance) {
    let position = ant_instance.getPosition();
    position.x = (position.x + this.board.size.x) % this.board.size.x;
    position.y = (position.y + this.board.size.y) % this.board.size.y;
    return position;
  }
}

// An ant operating for a Grid board
class Ant {
  constructor(scope, id) {
    this.scope = scope;
    this.id = id;
    this.steps = 0;
    this.direction = parseInt(Math.random() * this.scope.config.direction_count);
    this.generateInstructions();
  }

  setPosition(position) {
    this.position = position;
  }

  getPosition() {
    return this.position;
  }

  generateInstructions() {
    this.instructions = this.scope.config.generateInstructions();
  }

  step() {
    this.steps++;
    // Clamp direction to board-defined options
    this.direction = this.scope.getClampedDirection(this);
    // Using a basic offset behavior, odd-numbered rows are considered offset, while even are aligned.
    if (this.scope.config.board_style == "hex") {
      switch (this.direction) {
        case 0: // Northeast
          // Only on offset rows
          if (this.position.y % 2 == 1) {
            this.position.x++;
          }
          this.position.y--;
          break;
        case 1: // East
          this.position.x++;
          break;
        case 2: // Southeast
          // Only on offset rows
          if (this.position.y % 2 == 1) {
            this.position.x++;
          }
          this.position.y++;
          break;
        case 3: // Southwest
          // Only on aligned rows
          if (this.position.y % 2 == 0) {
            this.position.x--;
          }
          this.position.y++;
          break;
        case 4: // West
          this.position.x--;
          break;
        case 5: // Northwest
          // Only on aligned rows
          if (this.position.y % 2 == 0) {
            this.position.x--;
          }
          this.position.y--;
          break;
      }
    } else {
      switch (this.direction) {
        case 0: this.position.y--; break;
        case 1: this.position.x++; break;
        case 2: this.position.y++; break;
        case 3: this.position.x--; break;
      }
    }
    // TODO Abstract for Hex options, which is a 6-cycle behavior
    this.position = this.scope.getClampedPosition(this);
  }

  process() {
    this.step();
    let current_state = this.scope.board.getState(this);
    // TODO Modify direction for board states
    switch (this.instructions[current_state]) {
      case "left":
        this.direction--; break;
      case "right":
        this.direction++; break;
      case "left2":
        this.direction -= 2; break;
      case "right2":
        this.direction += 2; break;
      case "north":
        this.direction = 0; break;
      case "east":
        this.direction = 1; break;
      case "south":
        this.direction = 2; break;
      case "west":
        this.direction = 3; break;
      case "northeast":
        this.direction = 0; break;
      case "northwest":
        this.direction = 5; break;
      case "southeast":
        this.direction = 3; break;
      case "southwest":
        this.direction = 4; break;
      case "forward":
        break;
      case "reverse":
        this.direction += this.scope.config.direction_count / 2;
        break;
    }
  }
}

class Board {
  constructor(scope) {
    this.scope = scope;
  }

  initialize() {
    this.size = {
      x: parseInt(this.scope.width / this.scope.config.tile_size), // - 1 for hex to allow trailoff
      y: parseInt(this.scope.height / this.scope.config.tile_size),
      tile: this.scope.config.tile_size,
    };
    this.size.x -= this.scope.config.offset ? 1 : 0
    this.grid = new Array(this.size.y);
    for (let row = 0; row < this.size.y; row++) {
      this.grid[row] = new Array(this.size.x);
    }
    this.generatePalette();
  }

  // Returns the state occupied by the ant in question
  getState(ant) {
    const tile = this.grid[ant.getPosition().y][ant.getPosition().x];
    if (!tile) { return 0; }
    if (this.scope.config.ant_coloring == "rgb_blend") {
      return tile[ant.id];
    }
    return tile.state;
  }

  updateCellState(position, ant_id) {
    if (!this.grid[position.y][position.x]) {
      this.grid[position.y][position.x] = {
        state: 0,
        shift: 0,
        dirty: true,
        last_ant: null,
        r: 0,
        g: 0,
        b: 0,
      }
    }
    this.grid[position.y][position.x].dirty = true;
    if (this.scope.config.ant_coloring == "rgb_blend") {
      this.grid[position.y][position.x][ant_id]++;
      this.grid[position.y][position.x][ant_id] %= this.scope.config.instruction_count;
      return;
    }
    this.grid[position.y][position.x].state++;
    this.grid[position.y][position.x].last_ant = ant_id;
    if (this.grid[position.y][position.x].state >= this.scope.config.instruction_count) {
      this.grid[position.y][position.x].state %= this.scope.config.instruction_count
      this.grid[position.y][position.x].shift++;
    }
  }

  generatePalette() {
    if (this.scope.config.ant_coloring != "random") { return; }
    this.palette = [ "black" ];
    let min = this.scope.config.color_data.min;
    let range = this.scope.config.color_data.range;
    for (let i = 1; i < this.scope.config.instruction_count; i++) {
      let lightness = parseInt(Math.random() * range) + min;
      let hue = parseInt(Math.random() * 360);
      this.palette.push(`hsl(${hue}, ${this.scope.config.color_data.saturation}%, ${lightness}%)`);
    }
  }

  getColor(tile) {
    switch (this.scope.config.ant_coloring) {
      case "random":
        return this.palette[tile.state];
      case "rgb_blend":
        const r = 255 * tile.r / this.scope.config.instruction_count;
        const g = 255 * tile.g / this.scope.config.instruction_count;
        const b = 255 * tile.b / this.scope.config.instruction_count;
        return `rgb(${r}, ${g}, ${b})`;
      case "hsl":
        if (tile.last_ant == null) { return "black"; }
        const lightness = 50 * tile.state / this.scope.config.instruction_count;
        return `hsl(${tile.last_ant}, 100%, ${tile.state}%)`;
      case "hsl_grade":
        if (tile.last_ant == null) { return "black"; }
        return `hsl(${tile.last_ant + tile.state}, 100%, 50%)`;
      case "hsl_shift":
        if (tile.last_ant == null) { return "black"; }
        if (tile.shift > 0) {
          return `hsl(${tile.last_ant + (tile.shift-1)*this.scope.config.instruction_count+tile.state}, 100%, 50%)`
        }
        return `hsl(${tile.last_ant}, 100%, ${tile.state}%)`;
    }
    return "black";
  }

  _drawSquare(context, col, row) {
    let offset = this.scope.config.offset && row % 2 ? this.size.tile / 2 : 0;
    context.fillRect(col*this.size.tile + offset, row*this.size.tile, this.size.tile, this.size.tile);
  }

  // Shades the hex as if it's a 3d cube, due to an initial coding mistake.
  _drawHexDepth(context, col, row) {
    let half = this.size.tile / 2;
    let offset = row % 2 ? this.size.tile / 2 : 0;
    context.beginPath();
    context.moveTo(col*this.size.tile+offset, row*this.size.tile+2);
    context.lineTo(col*this.size.tile+offset+half, row*this.size.tile-2);
    context.lineTo((col+1)*this.size.tile+offset, row*this.size.tile+2);
    context.lineTo((col+1)*this.size.tile - (offset ? 0 : half), (row+1)*this.size.tile-2);
    context.lineTo(col*this.size.tile+offset+half, (row+1)*this.size.tile+2);
    context.lineTo(col*this.size.tile+offset, (row+1)*this.size.tile-2);
    context.lineTo(col*this.size.tile+offset, row*this.size.tile+2);
    context.fill();
  }

  _drawHexFlat(context, col, row) {
    let tile_radius = this.size.tile / 2;
    let center_x = col*this.size.tile + this.size.tile / (row % 2 ? 1 : 2);
    let center_y = row*this.size.tile + tile_radius;
    context.beginPath();
    context.moveTo(center_x, center_y + tile_radius);
    for (let i = 1; i <= 6; i++) {
      context.lineTo(
        center_x + tile_radius * Math.sin(i * 2 * Math.PI / 6),
        center_y + tile_radius * Math.cos(i * 2 * Math.PI / 6)
      );
    }
    context.fill();
  }

  draw(context) {
    for (let row = 0; row < this.size.y; row++) {
      for (let col = 0; col < this.size.x; col++) {
        if (!this.grid[row][col]) { continue; }
        if (!this.grid[row][col].dirty) { continue; }
        context.fillStyle = this.getColor(this.grid[row][col]);
        if (this.scope.config.draw_style == "square") {
          this._drawSquare(context, col, row);
        } else if (this.scope.config.draw_style == "hex_depth") {
          this._drawHexDepth(context, col, row);
        } else {
          this._drawHexFlat(context, col, row);
        }
        this.grid[row][col].dirty = false;
      }
    }
  }
}

class ScreenCleaner {
  constructor(scope) {
    this.scope = scope;
    this.state = {
      current: 0,
      idle: 0,
      running: 1,
      done: 2,
    };
    this.config = {};
    this.steps = 0;
  }

  start() {
    this.steps = 0;
    this.state.current = this.state.running;
    this.config.style = weighted_random({
      "fade_out": 1,
      "wipe_horizontal": 1,
      "wipe_vertical": 1,
      "shutter_horizontal": 1,
      "shutter_vertical": 1,
    });
    if (this.config.style == "fade_out") {
      this.config.steps_needed = 60;
    } else if (this.config.style == "wipe_horizontal") {
      this.config.radix = 8;
      this.config.steps_needed = (this.scope.height / this.config.radix)+1;
    } else if (this.config.style == "wipe_vertical") {
      this.config.radix = 8;
      this.config.steps_needed = (this.scope.width / this.config.radix)+1;
    } else if (this.config.style == "shutter_horizontal") {
      this.config.radix = 8;
      this.config.shutter_count = 12;
      this.config.steps_needed = (this.scope.height / this.config.radix)+1;
    } else if (this.config.style == "shutter_vertical") {
      this.config.radix = 8;
      this.config.shutter_count = 6;
      this.config.steps_needed = (this.scope.width / this.config.radix)+1;
    }
  }

  update() {
    this.steps++;
    if (this.steps >= this.config.steps_needed) {
      this.state.current = this.state.done;
    }
  }

  done() {
    this.state.current = this.state.idle;
  }

  _drawFadeOut(context) {
    let opacity = parseInt(Math.pow((this.steps+4)/4, 2));
    context.fillStyle = "#000000" + Number(opacity).toString(16).padStart(2, '0');
    if (this.state.current == this.state.done) {
      context.fillStyle = "#000000";
    }
    context.fillRect(0, 0, this.scope.width, this.scope.height);
  }

  _drawWipe(context, direction) {
    context.fillStyle = "black";
    let x = direction == "horizontal" ? 0 : this.config.radix*(this.steps-1);
    let y = direction == "horizontal" ? this.config.radix*(this.steps-1) : 0;
    let width = direction == "horizontal" ? this.scope.width : this.config.radix;
    let height = direction == "horizontal" ? this.config.radix : this.scope.height;
    context.fillRect(x, y, width, height);
  }

  _drawShutters(context, direction) {
    context.fillStyle = "black";
    // Odd shutters fill from opposite side
    // Uses wipe function, but spaced out for each shutter
    for (let i = 0; i < this.config.shutter_count; i++) {
      let x, y, width, height;
      if (direction == "horizontal") {
        x = i * this.scope.width / this.config.shutter_count;
        y = this.config.radix * (this.steps-1);
        width = this.scope.width / this.config.shutter_count;
        height = this.config.radix;
        if (i % 2) {
          y = this.scope.height - y;
          y -= this.config.radix;
        }
        width++;
      } else {
        x = this.config.radix * (this.steps-1);
        y = i * this.scope.height / this.config.shutter_count;
        width = this.config.radix;
        height = this.scope.height / this.config.shutter_count;
        if (i % 2) {
          x = this.scope.width - x;
          x -= this.config.radix;
        }
        height++;
      }
      context.fillRect(x, y, width, height);
    }
  }

  draw(context) {
    switch (this.config.style) {
      case "fade_out": this._drawFadeOut(context); break;
      case "wipe_horizontal": this._drawWipe(context, "horizontal"); break;
      case "wipe_vertical": this._drawWipe(context, "vertical"); break;
      case "shutter_horizontal": this._drawShutters(context, "horizontal"); break;
      case "shutter_vertical": this._drawShutters(context, "vertical"); break;
    }
  }
}
