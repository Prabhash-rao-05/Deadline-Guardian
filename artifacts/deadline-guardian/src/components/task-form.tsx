import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Task, TaskInput } from "@workspace/api-client-react/src/generated/api.schemas"
import { useCreateTask, useUpdateTask, useListCategories, getListTasksQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  deadline: z.string().min(1, "Deadline is required"),
  dueTime: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  categoryId: z.coerce.number().optional().nullable(),
  estimatedHours: z.coerce.number().optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "missed"]).default("pending")
})

export function TaskForm({ task, onSuccess }: { task?: Task | null, onSuccess: () => void }) {
  const { data: categories } = useListCategories()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      deadline: task?.deadline ? task.deadline.split('T')[0] : new Date().toISOString().split('T')[0],
      dueTime: task?.dueTime || "",
      priority: task?.priority || "medium",
      categoryId: task?.categoryId || undefined,
      estimatedHours: task?.estimatedHours || undefined,
      status: task?.status || "pending"
    }
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // clean up nulls/undefined for API
    const data: any = { ...values }
    if (!data.categoryId) delete data.categoryId
    if (!data.estimatedHours) delete data.estimatedHours
    if (!data.dueTime) delete data.dueTime

    if (task) {
      updateTask.mutate({ id: task.id, data }, {
        onSuccess: () => {
          toast({ title: "Task updated" })
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
          onSuccess()
        }
      })
    } else {
      createTask.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "Task created" })
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
          onSuccess()
        }
      })
    }
  }

  const isPending = createTask.isPending || updateTask.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Task title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Add details..." {...field} className="resize-none" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Time (optional)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="estimatedHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated Hours</FormLabel>
              <FormControl>
                <Input type="number" step="0.5" min="0" placeholder="e.g. 2.5" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {task ? "Update Task" : "Create Task"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
