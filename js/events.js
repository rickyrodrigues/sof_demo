// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBf5-lQmRvILKxXdTFIHthQPhMGTo_oSxo",
    authDomain: "shieldoffaithdemo.firebaseapp.com",
    projectId: "shieldoffaithdemo",
    storageBucket: "shieldoffaithdemo.firebasestorage.app",
    messagingSenderId: "353881791273",
    appId: "1:353881791273:web:4a74f00bc0fa8f190c7538",
    measurementId: "G-7X1S6JZG61"
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Calendar functionality
class EventCalendar {
    constructor() {
        this.currentDate = new Date();
        this.events = [];
        this.init();
    }

    async init() {
        console.log("Initializing calendar...");
        await this.loadEvents();
        console.log("Events loaded (after loadEvents call):", this.events);
        this.renderCalendar();
        this.setupEventListeners();
    }

    async loadEvents() {
        try {
            console.log("Attempting to load events from Firestore...");
            const eventsQuery = query(collection(db, 'events'), orderBy('date'));
            const querySnapshot = await getDocs(eventsQuery);
            this.events = [];
            querySnapshot.forEach((doc) => {
                this.events.push({ id: doc.id, ...doc.data() });
            });
            console.log("Raw events fetched from Firestore (before filtering):", this.events);

            this.renderEventCards();
            this.renderPastEvents(); // Call past events rendering

        } catch (error) {
            console.error('Error loading events from Firestore:', error);
        }
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Update header
        document.getElementById('currentMonthYear').textContent =
            new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Clear grid
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Add previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = document.createElement('button');
            day.className = 'calendar-day other-month';
            day.textContent = daysInPrevMonth - i;
            grid.appendChild(day);
        }

        // Add current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('button');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;

            const dayEvents = this.getEventsForDate(year, month, day);
            if (dayEvents.length > 0) {
                dayElement.classList.add('has-event');
                const dot = document.createElement('div');
                dot.className = 'event-dot';
                dayElement.appendChild(dot);
            }

            dayElement.addEventListener('click', (e) => this.showEventPopup(e, dayEvents));
            grid.appendChild(dayElement);
        }

        // Add next month days to fill grid
        const totalCells = grid.children.length;
        const remainingCells = 49 - totalCells; 
        let nextMonthDay = 1;
        for (let i = 0; i < remainingCells; i++) {
            const dayElement = document.createElement('button');
            dayElement.className = 'calendar-day other-month';
            dayElement.textContent = nextMonthDay++;
            grid.appendChild(dayElement);
        }
    }

    getEventsForDate(year, month, day) {
        return this.events.filter(event => {
            if (event.date && typeof event.date === 'object' && typeof event.date.seconds === 'number') {
                const eventDate = new Date(event.date.seconds * 1000);
                return eventDate.getFullYear() === year &&
                       eventDate.getMonth() === month &&
                       eventDate.getDate() === day;
            }
            console.warn("Event has invalid date format:", event);
            return false;
        });
    }

    showEventPopup(e, events) {
        const popup = document.getElementById('eventPopup');

        if (events.length === 0) {
            popup.classList.remove('show');
            return;
        }

        let popupHTML = '';
        events.forEach(event => {
            const eventTime = new Date(event.date.seconds * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            popupHTML += `
                <div class="popup-event">
                    <div class="popup-event-title">${event.title}</div>
                    <div class="popup-event-time">${eventTime}</div>
                </div>
            `;
        });

        popup.innerHTML = popupHTML;
        popup.style.left = (e.clientX + 10) + 'px';
        popup.style.top = (e.clientY + 10) + 'px';
        popup.classList.add('show');

        setTimeout(() => {
            document.addEventListener('click', (docClickEvent) => {
                if (!popup.contains(docClickEvent.target) && !e.target.contains(docClickEvent.target)) {
                    popup.classList.remove('show');
                }
            }, { once: true });
        }, 100);
    }

    renderEventCards() {
        const eventsGrid = document.getElementById('events-grid');
        eventsGrid.innerHTML = '';

        const now = new Date();
        console.log("Current time for upcoming events filtering:", now);

        const upcomingEvents = this.events.filter(event =>
            event.date && typeof event.date === 'object' && typeof event.date.seconds === 'number' &&
            new Date(event.date.seconds * 1000) >= now
        );

        console.log("Upcoming events after filtering:", upcomingEvents);

        if (upcomingEvents.length === 0) {
            eventsGrid.innerHTML = '<p class="text-center text-muted">No upcoming events at the moment.</p>';
            console.log("No upcoming events found. Displaying placeholder message.");
        } else {
            upcomingEvents.forEach(event => {
                const eventCard = this.createEventCard(event);
                eventsGrid.appendChild(eventCard);
            });
            console.log("Upcoming events rendered successfully. Total cards:", upcomingEvents.length);
        }
    }

    createEventCard(event) {
        let eventDate;
        if (event.date && typeof event.date.seconds === 'number') {
            eventDate = new Date(event.date.seconds * 1000);
        } else {
            console.warn("Event has invalid date, cannot create card:", event);
            return document.createElement('div');
        }

        const col = document.createElement('div');
        col.className = 'col event-item';
        col.setAttribute('data-age-group', event.ageGroup || 'all');
        col.setAttribute('data-age-group-display', event.ageGroupDisplay || 'All Ages');
        col.setAttribute('data-event-type', event.eventType || 'general');

        col.innerHTML = `
            <div class="event-card fade-in visible">
                <img src="${event.imageUrl || 'https://placehold.co/600x400/7B68EE/FFFFFF?text=Event'}"
                     alt="${event.title || 'Event Image'}" class="event-card-img">
                <div class="event-card-body">
                    <h3 class="event-title">${event.title || 'Untitled Event'}</h3>
                    <div class="event-meta">
                        <i class="far fa-calendar-alt"></i>
                        <span>${eventDate.toLocaleDateString()}</span>
                    </div>
                    <div class="event-meta">
                        <i class="far fa-clock"></i>
                        <span>${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                    <div class="event-meta">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${event.location || 'TBD'}</span>
                    </div>
                    <p class="event-description">${event.description || 'No description available.'}</p>
                    ${event.quote ? `<div class="event-quote">"${event.quote}"</div>` : ''}
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="age-badge badge-${event.ageGroup || 'all-ages'}">${event.ageGroupDisplay || 'All Ages'}</span>
                        ${event.registrationUrl ?
                            `<a href="${event.registrationUrl}" class="btn btn-sm btn-primary-custom rounded-pill" target="_blank">Register Now</a>` :
                            `<a href="contact.html" class="btn btn-sm btn-primary-custom rounded-pill">Learn More</a>`
                        }
                    </div>
                </div>
            </div>
        `;

        return col;
    }

    // FIXED METHOD FOR PAST EVENTS - Now renders event cards same as current events
    renderPastEvents() {
        console.log("Starting renderPastEvents method...");
        
        // Target the correct container - look for past-events-grid
        const pastEventsContainer = document.getElementById('past-events-grid');
        
        if (!pastEventsContainer) {
            console.error("Past events container not found! Looking for element with ID 'past-events-grid'");
            return;
        }

        console.log("Past events container found:", pastEventsContainer);

        // Clear existing content
        pastEventsContainer.innerHTML = '';

        const now = new Date();
        const pastEvents = this.events.filter(event => {
            if (event.date && typeof event.date === 'object' && typeof event.date.seconds === 'number') {
                const eventDate = new Date(event.date.seconds * 1000);
                return eventDate < now;
            }
            return false;
        }).reverse(); // Show most recent past events first

        console.log("Past events found:", pastEvents);

        if (pastEvents.length === 0) {
            pastEventsContainer.innerHTML = '<div class="col-12"><p class="text-center text-muted">No past events to display.</p></div>';
            console.log("No past events found, showing placeholder message");
            return;
        }

        // Render past events using the same card structure as current events
        pastEvents.forEach(event => {
            const eventCard = this.createEventCard(event);
            pastEventsContainer.appendChild(eventCard);
            console.log(`Added past event: ${event.title}`);
        });

        console.log("Past events rendering completed with", pastEvents.length, "events");
    }

    setupEventListeners() {
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');

        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        } else {
            console.warn("Element with ID 'prevMonth' not found.");
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        } else {
            console.warn("Element with ID 'nextMonth' not found.");
        }
    }
}

// Initialize calendar when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - Initializing EventCalendar");
    new EventCalendar();
}); 