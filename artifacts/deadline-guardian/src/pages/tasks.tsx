import { useState } from "react"
import { useAuth } from "@/components/auth-context"
import { useListTasks, useListCategories, useDeleteTask, useCompleteTask, useCreateTask, useUpdateTask } from "@workspace/api-client-react"
import { Task, TaskInput } from "@workspace/api-client-react/src/generated/api.schemas"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Search, Plus, Calendar, Clock, Tag, Flame, CheckCircle2, Circle, MoreVertical, Trash2, Edit2, AlertCircle } from "lucide-react"
import { format, parseISO } from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { getListTasksQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react"

// A simplified task form component to be rendered inside the Sheet
import { TaskForm } from "@/components/task-form"

export default function Tasks() {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: tasks, isLoading } = useListTasks({ 
    query: { enabled: !!user } 
  }, {
    query: {
      search: search || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      priority: priorityFilter !== "all" ? priorityFilter : undefined
    }
  })

  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Task deleted" })
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
        }
      })
    }
  }

  const handleComplete = (id: number) => {
    completeTask.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Task completed!", variant: "default" })
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
      }
    })
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setIsSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    if (!open) setEditingTask(null)
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-serif font-bold tracking-tight">Tasks</h2>
        
        <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
          <SheetTrigger asChild>
            <Button className="shadow-md">
              <Plus className="mr-2 h-4 w-4" /> New Task
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingTask ? "Edit Task" : "Create Task"}</SheetTitle>
              <SheetDescription>
                {editingTask ? "Update the details of your task." : "Add a new task to your workload."}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <TaskForm 
                task={editingTask} 
                onSuccess={() => setIsSheetOpen(false)} 
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters */}
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))
        ) : tasks?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No tasks found</h3>
            <p>Try adjusting your filters or create a new task.</p>
          </div>
        ) : (
          tasks?.map(task => (
            <Card 
              key={task.id} 
              className={`hover-elevate transition-all overflow-hidden ${task.status === 'completed' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-stretch border-l-4" style={{ borderLeftColor: task.category?.color || 'hsl(var(--primary))' }}>
                <div className="p-4 flex items-center justify-center border-r bg-muted/20">
                  <button 
                    onClick={() => task.status !== 'completed' && handleComplete(task.id)}
                    className="text-muted-foreground hover:text-emerald-500 transition-colors disabled:opacity-50"
                    disabled={task.status === 'completed' || completeTask.isPending}
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <Circle className="h-6 w-6" />
                    )}
                  </button>
                </div>
                
                <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-serif font-semibold text-lg ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </h4>
                      {getPriorityBadge(task.priority)}
                      {task.riskLevel === 'high' && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
                          </TooltipTrigger>
                          <TooltipContent>High Risk of missing deadline</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className={new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'text-destructive font-medium' : ''}>
                          {format(parseISO(task.deadline), "MMM d, yyyy")} {task.dueTime && `at ${task.dueTime}`}
                        </span>
                      </div>
                      
                      {task.category && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.category.color }} />
                          <span>{task.category.name}</span>
                        </div>
                      )}
                      
                      {task.estimatedHours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{task.estimatedHours}h est.</span>
                        </div>
                      )}
                      
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          <span>{task.tags.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(task)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
