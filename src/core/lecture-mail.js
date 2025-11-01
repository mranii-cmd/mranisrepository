class LectureMail {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.emailQueue = [];
        this.sentEmails = [];
        
        // Subscribe to relevant events if eventBus is provided
        if (this.eventBus) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Listen for lecture-related events
        this.eventBus.subscribe('lecture:created', (data) => this.handleLectureCreated(data));
        this.eventBus.subscribe('lecture:updated', (data) => this.handleLectureUpdated(data));
        this.eventBus.subscribe('lecture:cancelled', (data) => this.handleLectureCancelled(data));
        this.eventBus.subscribe('lecture:reminder', (data) => this.handleLectureReminder(data));
    }

    handleLectureCreated(lectureData) {
        const email = {
            type: 'lecture:created',
            recipients: this.getRecipients(lectureData),
            subject: `New Lecture: ${lectureData.title}`,
            body: this.generateLectureCreatedBody(lectureData),
            timestamp: new Date().toISOString(),
            lectureId: lectureData.id
        };
        this.queueEmail(email);
    }

    handleLectureUpdated(lectureData) {
        const email = {
            type: 'lecture:updated',
            recipients: this.getRecipients(lectureData),
            subject: `Lecture Updated: ${lectureData.title}`,
            body: this.generateLectureUpdatedBody(lectureData),
            timestamp: new Date().toISOString(),
            lectureId: lectureData.id
        };
        this.queueEmail(email);
    }

    handleLectureCancelled(lectureData) {
        const email = {
            type: 'lecture:cancelled',
            recipients: this.getRecipients(lectureData),
            subject: `Lecture Cancelled: ${lectureData.title}`,
            body: this.generateLectureCancelledBody(lectureData),
            timestamp: new Date().toISOString(),
            lectureId: lectureData.id
        };
        this.queueEmail(email);
    }

    handleLectureReminder(lectureData) {
        const email = {
            type: 'lecture:reminder',
            recipients: this.getRecipients(lectureData),
            subject: `Reminder: ${lectureData.title}`,
            body: this.generateLectureReminderBody(lectureData),
            timestamp: new Date().toISOString(),
            lectureId: lectureData.id
        };
        this.queueEmail(email);
    }

    getRecipients(lectureData) {
        const recipients = [];
        
        // Add teacher email if available
        if (lectureData.teacherEmail) {
            recipients.push(lectureData.teacherEmail);
        }
        
        // Add student emails if available
        if (lectureData.studentEmails && Array.isArray(lectureData.studentEmails)) {
            recipients.push(...lectureData.studentEmails);
        }
        
        return recipients;
    }

    generateLectureCreatedBody(lectureData) {
        return `A new lecture has been scheduled:\n\n` +
               `Title: ${lectureData.title}\n` +
               `Date: ${lectureData.date || 'TBD'}\n` +
               `Time: ${lectureData.time || 'TBD'}\n` +
               `Room: ${lectureData.room || 'TBD'}\n` +
               `Teacher: ${lectureData.teacherName || 'TBD'}\n\n` +
               `Please mark your calendar accordingly.`;
    }

    generateLectureUpdatedBody(lectureData) {
        return `A lecture has been updated:\n\n` +
               `Title: ${lectureData.title}\n` +
               `Date: ${lectureData.date || 'TBD'}\n` +
               `Time: ${lectureData.time || 'TBD'}\n` +
               `Room: ${lectureData.room || 'TBD'}\n` +
               `Teacher: ${lectureData.teacherName || 'TBD'}\n\n` +
               `Changes: ${lectureData.changes || 'See updated details above'}\n\n` +
               `Please check your schedule.`;
    }

    generateLectureCancelledBody(lectureData) {
        return `A lecture has been cancelled:\n\n` +
               `Title: ${lectureData.title}\n` +
               `Originally scheduled for: ${lectureData.date || 'TBD'} at ${lectureData.time || 'TBD'}\n` +
               `Room: ${lectureData.room || 'TBD'}\n\n` +
               `Reason: ${lectureData.reason || 'Not specified'}\n\n` +
               `We apologize for any inconvenience.`;
    }

    generateLectureReminderBody(lectureData) {
        return `Reminder: You have an upcoming lecture:\n\n` +
               `Title: ${lectureData.title}\n` +
               `Date: ${lectureData.date || 'TBD'}\n` +
               `Time: ${lectureData.time || 'TBD'}\n` +
               `Room: ${lectureData.room || 'TBD'}\n` +
               `Teacher: ${lectureData.teacherName || 'TBD'}\n\n` +
               `Don't forget to attend!`;
    }

    queueEmail(email) {
        this.emailQueue.push(email);
        return email;
    }

    sendEmail(email) {
        // In a real implementation, this would integrate with an email service
        // For now, we'll simulate sending and log the email
        console.log('Sending email:', {
            to: email.recipients,
            subject: email.subject,
            body: email.body
        });
        
        this.sentEmails.push({
            ...email,
            sentAt: new Date().toISOString(),
            status: 'sent'
        });
        
        return true;
    }

    processQueue() {
        const results = [];
        while (this.emailQueue.length > 0) {
            const email = this.emailQueue.shift();
            const success = this.sendEmail(email);
            results.push({ email, success });
        }
        return results;
    }

    getSentEmails(lectureId = null) {
        if (lectureId) {
            return this.sentEmails.filter(email => email.lectureId === lectureId);
        }
        return this.sentEmails;
    }

    getQueuedEmails() {
        return [...this.emailQueue];
    }

    clearQueue() {
        this.emailQueue = [];
    }

    clearSentEmails() {
        this.sentEmails = [];
    }
}

export default LectureMail;
