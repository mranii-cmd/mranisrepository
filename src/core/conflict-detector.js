class ConflictDetector {
    constructor(teachingSchedule) {
        this.teachingSchedule = teachingSchedule; // Array of scheduled classes
    }

    verifyTeacherAvailability(teacherId, timeSlot) {
        return this.teachingSchedule.every(schedule =>
            (schedule.teacherId !== teacherId || !this.isOverlapping(schedule.timeSlot, timeSlot))
        );
    }

    verifyRoomOccupation(roomId, timeSlot) {
        return this.teachingSchedule.every(schedule =>
            (schedule.roomId !== roomId || !this.isOverlapping(schedule.timeSlot, timeSlot))
        );
    }

    verifyGroupConflicts(groupId, timeSlot) {
        return this.teachingSchedule.every(schedule =>
            (schedule.groupId !== groupId || !this.isOverlapping(schedule.timeSlot, timeSlot))
        );
    }

    verifyDuplicates(newSchedule) {
        return this.teachingSchedule.every(schedule =>
            !this.isOverlapping(schedule.timeSlot, newSchedule.timeSlot)
        );
    }

    isOverlapping(timeSlot1, timeSlot2) {
        return (timeSlot1.start < timeSlot2.end && timeSlot2.start < timeSlot1.end);
    }
}