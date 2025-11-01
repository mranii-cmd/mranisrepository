/**
 * LectureMail class handles automated email notifications for lecture-related events.
 * It integrates with EventBus to listen for lecture events and send appropriate notifications.
 * 
 * @example
 * const eventBus = new EventBus();
 * const lectureMail = new LectureMail(eventBus);
 * 
 * eventBus.publish('lecture:created', {
 *   id: 'lec-001',
 *   title: 'Intro to JavaScript',
 *   teacherEmail: 'teacher@example.com',
 *   studentEmails: ['student1@example.com']
 * });
 * 
 * lectureMail.processQueue();
 */
class LectureMail {
    /**
     * Creates a new LectureMail instance.
     * @param {EventBus} eventBus - Optional EventBus instance for event-driven notifications
     */
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

    /**
     * Creates an email object with standardized structure.
     * @private
     * @param {string} type - Email type (e.g., 'lecture:created')
     * @param {Object} lectureData - Lecture data object
     * @param {string} subject - Email subject
     * @param {string} body - Email body content
     * @returns {Object} Email object
     */
    createEmailObject(type, lectureData, subject, body) {
        const recipients = this.getRecipients(lectureData);
        
        if (recipients.length === 0) {
            console.warn(`No recipients found for ${type} event. Email not created.`);
            return null;
        }
        
        return {
            type,
            recipients,
            subject,
            body,
            timestamp: new Date().toISOString(),
            lectureId: lectureData.id
        };
    }

    /**
     * Generic handler for lecture events.
     * @private
     * @param {string} type - Event type
     * @param {Object} lectureData - Lecture data
     * @param {string} subjectPrefix - Subject line prefix
     * @param {Function} bodyGenerator - Function to generate email body
     */
    handleLectureEvent(type, lectureData, subjectPrefix, bodyGenerator) {
        const email = this.createEmailObject(
            type,
            lectureData,
            `${subjectPrefix}: ${lectureData.title}`,
            bodyGenerator(lectureData)
        );
        if (email) {
            this.queueEmail(email);
        }
    }

    handleLectureCreated(lectureData) {
        this.handleLectureEvent(
            'lecture:created',
            lectureData,
            'New Lecture',
            (data) => this.generateLectureCreatedBody(data)
        );
    }

    handleLectureUpdated(lectureData) {
        this.handleLectureEvent(
            'lecture:updated',
            lectureData,
            'Lecture Updated',
            (data) => this.generateLectureUpdatedBody(data)
        );
    }

    handleLectureCancelled(lectureData) {
        this.handleLectureEvent(
            'lecture:cancelled',
            lectureData,
            'Lecture Cancelled',
            (data) => this.generateLectureCancelledBody(data)
        );
    }

    handleLectureReminder(lectureData) {
        this.handleLectureEvent(
            'lecture:reminder',
            lectureData,
            'Reminder',
            (data) => this.generateLectureReminderBody(data)
        );
    }

    /**
     * Validates if a string is a valid email format.
     * Uses a simple check to prevent ReDoS vulnerabilities.
     * @private
     * @param {string} email - Email address to validate
     * @returns {boolean} True if valid email format
     */
    isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        
        // Simple validation to prevent ReDoS: check for @ and . in the right positions
        const atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return false;
        }
        
        const dotIndex = email.lastIndexOf('.');
        if (dotIndex <= atIndex + 1 || dotIndex >= email.length - 1) {
            return false;
        }
        
        // Check for no whitespace
        if (/\s/.test(email)) {
            return false;
        }
        
        return true;
    }

    /**
     * Extracts and validates recipient email addresses from lecture data.
     * @param {Object} lectureData - Lecture data containing email addresses
     * @returns {Array<string>} Array of valid email addresses
     */
    getRecipients(lectureData) {
        const recipients = [];
        
        // Add teacher email if available and valid
        if (lectureData.teacherEmail && this.isValidEmail(lectureData.teacherEmail)) {
            recipients.push(lectureData.teacherEmail);
        }
        
        // Add student emails if available and valid
        if (lectureData.studentEmails && Array.isArray(lectureData.studentEmails)) {
            const validStudentEmails = lectureData.studentEmails.filter(email => 
                email && this.isValidEmail(email)
            );
            recipients.push(...validStudentEmails);
        }
        
        return recipients;
    }

    /**
     * Formats common lecture details for email body.
     * @private
     * @param {Object} lectureData - Lecture data
     * @returns {string} Formatted lecture details
     */
    formatLectureDetails(lectureData) {
        return `Title: ${lectureData.title}\n` +
               `Date: ${lectureData.date || 'TBD'}\n` +
               `Time: ${lectureData.time || 'TBD'}\n` +
               `Room: ${lectureData.room || 'TBD'}\n` +
               `Teacher: ${lectureData.teacherName || 'TBD'}`;
    }

    generateLectureCreatedBody(lectureData) {
        return `A new lecture has been scheduled:\n\n` +
               `${this.formatLectureDetails(lectureData)}\n\n` +
               `Please mark your calendar accordingly.`;
    }

    generateLectureUpdatedBody(lectureData) {
        return `A lecture has been updated:\n\n` +
               `${this.formatLectureDetails(lectureData)}\n\n` +
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
               `${this.formatLectureDetails(lectureData)}\n\n` +
               `Don't forget to attend!`;
    }

    /**
     * Adds an email to the queue for later processing.
     * @param {Object} email - Email object to queue
     * @returns {Object} The queued email object
     */
    queueEmail(email) {
        this.emailQueue.push(email);
        return email;
    }

    /**
     * Sends a single email.
     * In production, this should integrate with an actual email service.
     * @param {Object} email - Email object to send
     * @returns {Object} Result object with success status and optional error
     */
    sendEmail(email) {
        try {
            // Validate recipients exist
            if (!email.recipients || email.recipients.length === 0) {
                throw new Error('No recipients specified');
            }
            
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
            
            return { success: true };
        } catch (error) {
            console.error('Failed to send email:', error.message);
            
            this.sentEmails.push({
                ...email,
                sentAt: new Date().toISOString(),
                status: 'failed',
                error: error.message
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Processes all emails in the queue.
     * @returns {Array<Object>} Array of results with email and success status
     */
    processQueue() {
        const results = [];
        while (this.emailQueue.length > 0) {
            const email = this.emailQueue.shift();
            const result = this.sendEmail(email);
            results.push({ email, ...result });
        }
        return results;
    }

    /**
     * Retrieves sent emails, optionally filtered by lecture ID.
     * @param {string} lectureId - Optional lecture ID to filter by
     * @returns {Array<Object>} Array of sent email objects
     */
    getSentEmails(lectureId = null) {
        if (lectureId) {
            return this.sentEmails.filter(email => email.lectureId === lectureId);
        }
        return this.sentEmails;
    }

    /**
     * Gets a copy of all queued emails waiting to be sent.
     * @returns {Array<Object>} Array of queued email objects
     */
    getQueuedEmails() {
        return [...this.emailQueue];
    }

    /**
     * Clears all emails from the queue without sending them.
     */
    clearQueue() {
        this.emailQueue = [];
    }

    /**
     * Clears the history of sent emails.
     */
    clearSentEmails() {
        this.sentEmails = [];
    }
}

export default LectureMail;
