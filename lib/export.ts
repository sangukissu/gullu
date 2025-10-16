import { format, addMinutes } from "date-fns"
import type { PlannerTask } from "@/components/types"

// Utility to detect platform
export function detectPlatform() {
  if (typeof window === 'undefined') return 'unknown'
  
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isMac = /macintosh|mac os x/i.test(userAgent)
  const isIOS = /iphone|ipad|ipod/i.test(userAgent)
  const isAndroid = /android/i.test(userAgent)
  
  if (isMac || isIOS) return 'apple'
  if (isAndroid) return 'android'
  return 'other'
}

// Convert minutes since midnight to time string
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}${mins.toString().padStart(2, '0')}`
}

// Generate ICS format for calendar apps
export function generateICS(tasks: PlannerTask[], date: Date): string {
  const dateStr = format(date, 'yyyyMMdd')
  
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planner App//Task Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  tasks.forEach((task, index) => {
    if (!task.startMin || !task.durationMin) return

    const startTime = minutesToTime(task.startMin)
    const endTime = minutesToTime(task.startMin + task.durationMin)
    const uid = `task-${task.id}-${dateStr}@planner.app`
    
    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dateStr}T${startTime}00`,
      `DTEND:${dateStr}T${endTime}00`,
      `SUMMARY:${task.title}`,
      `DESCRIPTION:${task.icon} ${task.category} task - ${task.durationMin}min`,
      `CATEGORIES:${task.category}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    )
  })

  ics.push('END:VCALENDAR')
  return ics.join('\r\n')
}

// Generate Apple Reminders URL scheme
export function generateAppleRemindersURL(tasks: PlannerTask[], date: Date): string {
  const scheduledTasks = tasks.filter(task => task.startMin !== undefined && task.durationMin !== undefined)
  
  if (scheduledTasks.length === 0) return ''
  
  // For multiple tasks, we'll create a reminder list
  const listName = `Tasks for ${format(date, 'MMM dd, yyyy')}`
  let url = `x-apple-reminderkit://REMCDReminder`
  
  // Create the first reminder with list creation
  const firstTask = scheduledTasks[0]
  const dueDate = addMinutes(date, firstTask.startMin!)
  
  const params = new URLSearchParams({
    title: firstTask.title,
    notes: `${firstTask.icon} ${firstTask.category} task - ${firstTask.durationMin}min`,
    dueDate: dueDate.toISOString(),
    list: listName
  })
  
  return `${url}?${params.toString()}`
}

// Download ICS file for Android/other platforms
export function downloadICS(tasks: PlannerTask[], date: Date): void {
  const icsContent = generateICS(tasks, date)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `planner-tasks-${format(date, 'yyyy-MM-dd')}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

// Main export function that handles platform-specific exports
export function exportTasks(tasks: PlannerTask[], date: Date): void {
  const platform = detectPlatform()
  const scheduledTasks = tasks.filter(task => task.startMin !== undefined && task.durationMin !== undefined)
  
  if (scheduledTasks.length === 0) {
    alert('No scheduled tasks to export!')
    return
  }
  
  switch (platform) {
    case 'apple':
      // Try Apple Reminders first, fallback to ICS download
      const reminderURL = generateAppleRemindersURL(scheduledTasks, date)
      if (reminderURL) {
        window.location.href = reminderURL
      } else {
        downloadICS(scheduledTasks, date)
      }
      break
      
    case 'android':
    case 'other':
    default:
      // Download ICS file for calendar import
      downloadICS(scheduledTasks, date)
      break
  }
}

// Export for Google Calendar (web-based)
export function exportToGoogleCalendar(tasks: PlannerTask[], date: Date): void {
  const scheduledTasks = tasks.filter(task => task.startMin !== undefined && task.durationMin !== undefined)
  
  if (scheduledTasks.length === 0) {
    alert('No scheduled tasks to export!')
    return
  }
  
  // For Google Calendar, we'll create multiple events
  scheduledTasks.forEach(task => {
    const startDate = addMinutes(date, task.startMin!)
    const endDate = addMinutes(startDate, task.durationMin!)
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: task.title,
      dates: `${format(startDate, "yyyyMMdd'T'HHmmss")}/${format(endDate, "yyyyMMdd'T'HHmmss")}`,
      details: `${task.icon} ${task.category} task`,
      location: '',
      trp: 'false'
    })
    
    const url = `https://calendar.google.com/calendar/render?${params.toString()}`
    window.open(url, '_blank')
  })
}