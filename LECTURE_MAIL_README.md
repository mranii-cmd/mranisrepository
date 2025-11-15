# LectureMail - Email Notification System for Lectures

## Overview

The `LectureMail` class provides automated email notification functionality for lecture management systems. It integrates with the EventBus to send emails when lecture-related events occur.

## Features

- **Automated Notifications**: Automatically sends emails based on lecture events
- **Event-Driven**: Integrates with EventBus for seamless event handling
- **Queue Management**: Queues emails for batch processing
- **Email History**: Tracks all sent emails for auditing
- **Multiple Event Types**: Supports creation, updates, cancellations, and reminders

## Usage

### Basic Setup

```javascript
import EventBus from './src/core/event-bus.js';
import LectureMail from './src/core/lecture-mail.js';

// Create instances
const eventBus = new EventBus();
const lectureMail = new LectureMail(eventBus);
```

### Sending Lecture Notifications

The system automatically listens for the following events:

#### 1. Lecture Created
```javascript
eventBus.publish('lecture:created', {
    id: 'lec-001',
    title: 'Introduction to JavaScript',
    date: '2025-11-05',
    time: '10:00 AM',
    room: 'Room 101',
    teacherName: 'Dr. Smith',
    teacherEmail: 'smith@university.edu',
    studentEmails: ['student1@university.edu', 'student2@university.edu']
});
```

#### 2. Lecture Updated
```javascript
eventBus.publish('lecture:updated', {
    id: 'lec-001',
    title: 'Introduction to JavaScript',
    date: '2025-11-05',
    time: '11:00 AM',
    room: 'Room 102',
    teacherName: 'Dr. Smith',
    teacherEmail: 'smith@university.edu',
    studentEmails: ['student1@university.edu', 'student2@university.edu'],
    changes: 'Time and room updated'
});
```

#### 3. Lecture Cancelled
```javascript
eventBus.publish('lecture:cancelled', {
    id: 'lec-002',
    title: 'Advanced Algorithms',
    date: '2025-11-06',
    time: '2:00 PM',
    room: 'Room 201',
    teacherEmail: 'jones@university.edu',
    studentEmails: ['student3@university.edu'],
    reason: 'Instructor illness'
});
```

#### 4. Lecture Reminder
```javascript
eventBus.publish('lecture:reminder', {
    id: 'lec-003',
    title: 'Database Design',
    date: '2025-11-07',
    time: '9:00 AM',
    room: 'Lab A',
    teacherName: 'Prof. Johnson',
    teacherEmail: 'johnson@university.edu',
    studentEmails: ['student4@university.edu', 'student5@university.edu']
});
```

### Processing Email Queue

```javascript
// Process all queued emails
const results = lectureMail.processQueue();

// Get all sent emails
const sentEmails = lectureMail.getSentEmails();

// Get emails for a specific lecture
const lectureEmails = lectureMail.getSentEmails('lec-001');

// Check queued emails
const queuedEmails = lectureMail.getQueuedEmails();

// Clear queue without sending
lectureMail.clearQueue();

// Clear sent email history
lectureMail.clearSentEmails();
```

## API Reference

### Constructor

```javascript
new LectureMail(eventBus)
```

- **eventBus** (EventBus, optional): EventBus instance for event-driven email sending

### Methods

#### `queueEmail(email)`
Adds an email to the queue.

#### `sendEmail(email)`
Sends a single email immediately.

#### `processQueue()`
Processes all queued emails and returns results.

#### `getSentEmails(lectureId?)`
Retrieves sent emails, optionally filtered by lecture ID.

#### `getQueuedEmails()`
Returns a copy of the current email queue.

#### `clearQueue()`
Clears all queued emails without sending.

#### `clearSentEmails()`
Clears the sent email history.

## Email Structure

Each email object contains:
- **type**: Event type (e.g., 'lecture:created')
- **recipients**: Array of email addresses
- **subject**: Email subject line
- **body**: Email body text
- **timestamp**: ISO timestamp when queued
- **lectureId**: Associated lecture ID
- **sentAt**: ISO timestamp when sent (after processing)
- **status**: Sending status (after processing)

## Integration with Other Modules

The LectureMail class works seamlessly with:
- **EventBus**: For event-driven notifications
- **StateManager**: Can be used to persist email state
- **DataRepository**: Can be used to store email history
- **ConflictDetector**: Can trigger notifications on conflict resolution

## Notes

- In the current implementation, emails are logged to console
- For production use, integrate with an actual email service (e.g., SendGrid, AWS SES)
- Ensure proper validation of email addresses before sending
- Consider implementing rate limiting for email sending
