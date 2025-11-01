class VolumeCalculator {
    constructor() {
        this.cache = {};
    }

    calculateVolume(teacherHeight, teacherWidth, teacherDepth) {
        const key = `${teacherHeight}-${teacherWidth}-${teacherDepth}`;
        
        if (this.cache[key]) {
            return this.cache[key];
        }
        
        const volume = teacherHeight * teacherWidth * teacherDepth; // Volume Calculation
        this.cache[key] = volume;
        return volume;
    }
}

module.exports = VolumeCalculator;