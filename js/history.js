FF.History = class {
    constructor(maxSize = 50) {
        this.stack = [];
        this.pointer = -1;
        this.maxSize = maxSize;
    }

    push(snapshot) {
        this.stack = this.stack.slice(0, this.pointer + 1);
        this.stack.push(snapshot);
        if (this.stack.length > this.maxSize) {
            this.stack.shift();
        }
        this.pointer = this.stack.length - 1;
    }

    undo() {
        if (this.pointer > 0) {
            this.pointer--;
            return this.stack[this.pointer];
        }
        return null;
    }

    redo() {
        if (this.pointer < this.stack.length - 1) {
            this.pointer++;
            return this.stack[this.pointer];
        }
        return null;
    }

    canUndo() {
        return this.pointer > 0;
    }

    canRedo() {
        return this.pointer < this.stack.length - 1;
    }

    clear() {
        this.stack = [];
        this.pointer = -1;
    }
};
