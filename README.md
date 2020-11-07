Langton's xAnt
==============

Overview
--------

Langton's Ant is a two-dimensional cellular automaton where an "ant" square operates based on the state of the board.
In the base scenario, an ant has two rules:

* On a white square, the ant turns right, flips the color of the square, and moves forward one unit.
* On a black square, the ant turns left, flips the color of the square, and moves forward one unit.

These instructions, after about 11,000 iterations, start to produce a highway (a pathway made up of a repeating pattern).
While this can extend to infinity, an ant placed on a torus will eventually cycle back and collide with a previously-modified area
of the board, reverting back to chaos.

Extensions
----------

This two-state pattern can be extended readily into multiple board states, cycling back to zero when the last available state is reached.
For instance, the instruction set "LRRRRRLLR" will create a square that fills with color (an image is available under the Wikipedia article for Langton's Ant).

Multiple ants can operate on the same board, and while the "common" approach does not worry about conflict resolution from two ants on the same tile, this
implementation updates the state sequentially for all crowded ants.

Additionally, while operating on a torus, I've found some interesting results by introducing six new instructions to the square-based grid:
- North
- South
- East
- West
- Forward (No op)
- Reverse

These instructions add some additional interactions, and cause highways to appear much more frequently.

Applications
------------

There are several possible applications of Langton's Ant (and more generally, Turmites, which are ants with multiple states in addition to board states).
However, I'm not trying to demonstrate anything with this project. The `xant.html` file, though, will serve as an ever-changing wall art/screensaver, generating a random instruction set every half hour.
