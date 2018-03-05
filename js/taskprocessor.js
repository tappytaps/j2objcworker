const PROCESSING_TIMEOUT = 2000 // 1 second

class TaskProcessor {
    constructor(timeout = PROCESSING_TIMEOUT) {
        this.timeout = timeout
        this.files = []
        this.timer = null
        this.processQueue = null        
        this.paused = false
    }

    addFile(name) {
        this.files.push(name)
        if (!this.paused) {
            this.__sheduleTimer()
        }
    }

    pause() {
        this.__cancelTimer()
        this.paused = false
    }

    resume() {
        this.__sheduleTimer()
        this.paused = false
    }


    __cancelTimer() {
        if (this.timer) {
            clearTimeout(this.timer)
        }        
    }

    __sheduleTimer() {
        if (this.files.length > 0) {
            if (this.timer) {
                clearTimeout(this.timer)
            }        
            this.timer = setTimeout(() => {
                if (this.processQueue) {
                    this.processQueue(this.files)
                    this.files = []
                }            
            }, this.timeout)    
        }
    }

}

module.exports = TaskProcessor