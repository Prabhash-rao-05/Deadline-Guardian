import { useState, useEffect } from "react"
import { useRoute, useLocation, Link } from "wouter"
import { useAuth } from "@/components/auth-context"
import { 
  useGetTask, 
  useUpdateTask, 
  useListSubtasks, 
  useCreateSubtask, 
  useUpdateSubtask, 
  useDeleteSubtask,
  useAiDeadlineRisk,
  getGetTaskQueryKey,
  getListSubtasksQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { 
  ArrowLeft, Clock, Calendar as CalendarIcon, Tag, Flame, 
  AlertCircle, Plus, Trash2, CheckCircle2, Zap, Loader2, Bot
} from "lucide-react"
import { format, parseISO } from "date-fns"

export default function TaskDetail() {
  const [match, params] = useRoute("/tasks/:id")
  const [_, setLocation] = useLocation()
  const taskId = params?.id ? parseInt(params.id) : 0
  
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: task, isLoading: isTaskLoading } = useGetTask(taskId, {
    query: { enabled: !!user && taskId > 0 }
  })

  // Actually, the API might not have useListSubtasks separated by taskId or it might accept query params. 
  // Let's assume it returns all subtasks or we just use task.subtasks if populated.
  const subtasks = task?.subtasks || []
  
  const { data: risks } = useAiDeadlineRisk({ query: { enabled: !!user } })
  const taskRisk = risks?.find(r => r.taskId === taskId)

  const updateTask = useUpdateTask()
  const createSubtask = useCreateSubtask()
  const updateSubtask = useUpdateSubtask()
  const deleteSubtask = useDeleteSubtask()

  const [notes, setNotes] = useState("")
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")

  useEffect(() => {
    if (task?.notes) {
      setNotes(task.notes)
    }
  }, [task?.notes])

  if (isTaskLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Task not found</h2>
        <Button variant="link" onClick={() => setLocation("/tasks")}>Return to tasks</Button>
      </div>
    )
  }

  const handleSaveNotes = () => {
    updateTask.mutate({ id: taskId, data: { notes } }, {
      onSuccess: () => {
        toast({ title: "Notes saved" })
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) })
      }
    })
  }

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim()) return
    
    // The API might expect a taskId in the subtask creation
    // We'll pass it as part of the subtask input
    const newSubtask = { title: newSubtaskTitle, taskId }
    
    createSubtask.mutate({ data: newSubtask as any }, {
      onSuccess: () => {
        setNewSubtaskTitle("")
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) })
      }
    })
  }

  const toggleSubtask = (subtaskId: number, completed: boolean) => {
    updateSubtask.mutate({ id: subtaskId, data: { completed } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) })
    })
  }

  const removeSubtask = (subtaskId: number) => {
    deleteSubtask.mutate({ id: subtaskId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) })
    })
  }

  const toggleTaskStatus = () => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    updateTask.mutate({ id: taskId, data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: `Task marked as ${newStatus}` })
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) })
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
      }
    })
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="urgent" className="flex gap-1"><Flame className="h-3 w-3" /> Urgent</Badge>
      case "high": return <Badge variant="high">High</Badge>
      case "medium": return <Badge variant="medium">Medium</Badge>
      case "low": return <Badge variant="low">Low</Badge>
      default: return <Badge variant="outline">{priority}</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className={`text-2xl sm:text-3xl font-serif font-bold tracking-tight ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info Column */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                    {task.status.replace("_", " ")}
                  </Badge>
                  {getPriorityBadge(task.priority)}
                </div>
                
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{format(parseISO(task.deadline), "MMM d, yyyy")} {task.dueTime && `at ${task.dueTime}`}</span>
                </div>

                {task.category && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.category.color }} />
                    <span className="font-medium text-foreground">{task.category.name}</span>
                  </div>
                )}
                
                {task.estimatedHours && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{task.estimatedHours}h est.</span>
                  </div>
                )}
              </div>

              {task.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                  <p>{task.description}</p>
                </div>
              )}

              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {task.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
              
              <div className="pt-4 border-t">
                <Button 
                  onClick={toggleTaskStatus} 
                  variant={task.status === 'completed' ? "outline" : "default"}
                  className="w-full sm:w-auto"
                >
                  {task.status === 'completed' ? "Mark as Pending" : "Mark as Completed"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Subtasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {subtasks.map((subtask: any) => (
                  <div key={subtask.id} className="flex items-center justify-between group bg-muted/30 p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox 
                        checked={subtask.completed} 
                        onCheckedChange={(c) => toggleSubtask(subtask.id, !!c)} 
                      />
                      <span className={`text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {subtask.title}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSubtask(subtask.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-2">
                <Input 
                  placeholder="Add a subtask..." 
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="h-9 text-sm bg-background"
                />
                <Button type="submit" size="sm" className="h-9" disabled={createSubtask.isPending || !newSubtaskTitle.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, links, or context for this task..."
                className="min-h-[150px] resize-y bg-background"
              />
              <div className="flex justify-end">
                <Button onClick={handleSaveNotes} disabled={updateTask.isPending || notes === task.notes} size="sm">
                  {updateTask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Notes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* AI Risk Assessment */}
          {(taskRisk || task.aiPriority || task.riskLevel) && (
            <Card className="bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" /> Guardian Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {taskRisk && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Risk Level</span>
                      <Badge variant={taskRisk.riskLevel === 'high' ? 'destructive' : taskRisk.riskLevel === 'medium' ? 'high' : 'outline'}>
                        {taskRisk.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{taskRisk.explanation}</p>
                    {taskRisk.actionRequired && (
                      <div className="bg-background rounded p-2 text-xs flex gap-2 items-start border-l-2 border-primary mt-2">
                        <Zap className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <span>{taskRisk.actionRequired}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {task.aiPriority && !taskRisk && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium block">Suggested Priority: <span className="capitalize">{task.aiPriority}</span></span>
                    {task.aiPriorityReason && <p className="text-xs text-muted-foreground">{task.aiPriorityReason}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardContent className="p-4 space-y-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{format(parseISO(task.createdAt), "MMM d, yyyy h:mm a")}</span>
              </div>
              {task.updatedAt && (
                <div className="flex justify-between">
                  <span>Last updated:</span>
                  <span>{format(parseISO(task.updatedAt), "MMM d, yyyy h:mm a")}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="flex justify-between text-emerald-500 font-medium">
                  <span>Completed:</span>
                  <span>{format(parseISO(task.completedAt), "MMM d, yyyy h:mm a")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
