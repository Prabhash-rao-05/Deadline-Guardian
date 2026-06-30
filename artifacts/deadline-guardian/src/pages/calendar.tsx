import { useState } from "react"
import { useAuth } from "@/components/auth-context"
import { useListTasks, useCompleteTask } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CheckCircle2, Clock } from "lucide-react"
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO } from "date-fns"

export default function Calendar() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week">("month")

  const { data: tasks } = useListTasks({ query: { enabled: !!user } })
  const completeTask = useCompleteTask()

  const handleComplete = (id: number) => {
    completeTask.mutate({ id })
  }

  const nextPeriod = () => setCurrentDate(addDays(currentDate, view === "month" ? 30 : 7))
  const prevPeriod = () => setCurrentDate(addDays(currentDate, view === "month" ? -30 : -7))
  const goToToday = () => setCurrentDate(new Date())

  // Generate days based on view
  const days = view === "month" 
    ? eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
    : Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))

  const getTasksForDay = (day: Date) => {
    return tasks?.filter(task => isSameDay(parseISO(task.deadline), day)) || []
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-destructive text-destructive-foreground"
      case "high": return "bg-amber-500 text-white"
      case "medium": return "bg-yellow-500 text-white"
      case "low": return "bg-blue-500 text-white"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-serif font-bold tracking-tight">Calendar</h2>
          <p className="text-muted-foreground">Schedule and deadlines at a glance.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border rounded-lg p-1 shadow-sm">
          <Button variant={view === "month" ? "secondary" : "ghost"} size="sm" onClick={() => setView("month")}>Month</Button>
          <Button variant={view === "week" ? "secondary" : "ghost"} size="sm" onClick={() => setView("week")}>Week</Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold w-48">
              {format(currentDate, view === "month" ? "MMMM yyyy" : "MMM d, yyyy")}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPeriod}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-card">
          {view === "month" ? (
             <div className="grid grid-cols-7 h-full min-h-[600px] auto-rows-fr">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b border-r bg-muted/10 shrink-0 h-10">
                  {day}
                </div>
              ))}
              
              {/* Padding for first day offset */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="border-b border-r bg-muted/5" />
              ))}
              
              {days.map((day, i) => {
                const dayTasks = getTasksForDay(day)
                return (
                  <div key={i} className={`border-b border-r p-2 flex flex-col gap-1 transition-colors hover:bg-muted/10 ${isToday(day) ? 'bg-primary/5' : ''}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                        {format(day, "d")}
                      </span>
                      {dayTasks.length > 0 && <span className="text-[10px] text-muted-foreground">{dayTasks.length} tasks</span>}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                      {dayTasks.map(task => (
                        <div 
                          key={task.id} 
                          className={`text-[10px] px-1.5 py-1 rounded truncate flex items-center justify-between group cursor-pointer ${
                            task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-700 line-through' : 
                            task.status === 'missed' ? 'bg-destructive/20 text-destructive' :
                            'bg-accent/10 text-foreground border border-accent/20 hover:border-accent/50'
                          }`}
                          title={task.title}
                        >
                          <span className="truncate">{task.title}</span>
                          {!['completed', 'missed'].includes(task.status) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleComplete(task.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
             </div>
          ) : (
            <div className="flex h-full min-h-[500px] divide-x">
              {days.map((day, i) => {
                const dayTasks = getTasksForDay(day)
                return (
                  <div key={i} className={`flex-1 flex flex-col ${isToday(day) ? 'bg-primary/5' : ''}`}>
                    <div className="p-3 border-b text-center shrink-0">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{format(day, "EEE")}</div>
                      <div className={`text-2xl font-serif mt-1 ${isToday(day) ? 'text-primary font-bold' : ''}`}>{format(day, "d")}</div>
                    </div>
                    <div className="flex-1 p-2 space-y-2 overflow-auto">
                      {dayTasks.map(task => (
                        <Card key={task.id} className={`p-3 text-sm shadow-sm ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className={`font-medium leading-tight ${task.status === 'completed' ? 'line-through' : ''}`}>
                              {task.title}
                            </span>
                            <Badge className={`${getPriorityColor(task.priority)} text-[10px] px-1 py-0`}>
                              {task.priority}
                            </Badge>
                          </div>
                          {task.dueTime && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" /> {task.dueTime}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
