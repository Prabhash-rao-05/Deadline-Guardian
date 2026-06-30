import { useState } from "react"
import { useAuth } from "@/components/auth-context"
import { useAiDeadlineRisk, useAiGetSuggestions, useAiChat, useAiParseNaturalLanguageTask, useCreateTask, getListTasksQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Bot, Sparkles, AlertCircle, Clock, Zap, Send, Loader2, ArrowRight, Flame } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas"

export default function AiFeatures() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: risks, isLoading: isRisksLoading } = useAiDeadlineRisk({ query: { enabled: !!user } })
  const { data: suggestions, isLoading: isSuggestionsLoading } = useAiGetSuggestions({ query: { enabled: !!user } })
  
  const parseTask = useAiParseNaturalLanguageTask()
  const createTask = useCreateTask()
  const chat = useAiChat()

  const [nlInput, setNlInput] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm Guardian. I can help you prioritize tasks, break down complex projects, or reschedule your day. How can I help?" }
  ])

  const handleNlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nlInput.trim()) return

    parseTask.mutate({ data: { text: nlInput } }, {
      onSuccess: (parsed) => {
        // Automatically create the task from parsed result
        createTask.mutate({
          data: {
            title: parsed.title,
            description: parsed.description || "",
            deadline: parsed.deadline || new Date().toISOString().split('T')[0],
            priority: parsed.priority || "medium",
            estimatedHours: parsed.estimatedHours || undefined,
            tags: parsed.tags || []
          }
        }, {
          onSuccess: () => {
            toast({ title: "Task created magically!", description: `Created: ${parsed.title}` })
            setNlInput("")
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
          }
        })
      },
      onError: () => {
        toast({ variant: "destructive", title: "Couldn't understand", description: "Please try rephrasing your task." })
      }
    })
  }

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const newMessages = [...messages, { role: 'user' as const, content: chatInput }]
    setMessages(newMessages)
    setChatInput("")

    chat.mutate({
      data: { message: chatInput, conversationHistory: messages }
    }, {
      onSuccess: (reply) => {
        setMessages([...newMessages, { role: 'assistant' as const, content: reply.message }])
      }
    })
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h2 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary" /> AI Features
        </h2>
        <p className="text-muted-foreground">Your intelligent productivity command center.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Natural Language Task Creation */}
        <Card className="lg:col-span-3 bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <form onSubmit={handleNlSubmit} className="flex items-center gap-4">
              <Sparkles className="h-6 w-6 text-primary shrink-0 hidden sm:block" />
              <Input 
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                placeholder="Try: 'Remind me to submit the Q3 report by Friday at 3pm high priority'"
                className="text-lg py-6 bg-background/80 shadow-inner"
              />
              <Button type="submit" size="lg" disabled={parseTask.isPending || createTask.isPending}>
                {(parseTask.isPending || createTask.isPending) ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Risk Assessment Panel */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> 
              Deadline Risk Assessment
            </CardTitle>
            <CardDescription>AI analysis of tasks likely to miss their deadlines</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isRisksLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : risks?.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
                <p>All tasks look safe! Your schedule is realistic.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {risks?.map(risk => (
                  <div key={risk.taskId} className="bg-muted/50 border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant={risk.riskLevel === 'high' ? 'destructive' : risk.riskLevel === 'medium' ? 'high' : 'outline'} className="mb-2">
                          {risk.riskLevel.toUpperCase()} RISK
                        </Badge>
                        <p className="text-sm font-medium">{risk.explanation}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-destructive">{risk.riskPercentage}%</span>
                        <p className="text-xs text-muted-foreground">Fail Probability</p>
                      </div>
                    </div>
                    
                    {risk.actionRequired && (
                      <div className="bg-background rounded p-2 text-sm flex gap-2 items-start border-l-2 border-primary">
                        <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span><strong>Action:</strong> {risk.actionRequired}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Suggestions Feed */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> 
              Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-3">
                {isSuggestionsLoading ? (
                  <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : suggestions?.length === 0 ? (
                   <p className="text-center text-sm text-muted-foreground p-4">No suggestions right now. Keep up the good work!</p>
                ) : (
                  suggestions?.map(sugg => (
                    <div key={sugg.id} className="bg-card border rounded-lg p-3 hover:border-primary/50 transition-colors shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        {sugg.type === 'break_task' ? <Clock className="h-4 w-4 text-blue-500" /> :
                         sugg.type === 'start_now' ? <Flame className="h-4 w-4 text-orange-500" /> :
                         <Sparkles className="h-4 w-4 text-primary" />}
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {sugg.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm mb-3">{sugg.message}</p>
                      {sugg.actionLabel && (
                        <Button size="sm" variant="secondary" className="w-full text-xs h-8">
                          {sugg.actionLabel} <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* AI Chat Assistant */}
        <Card className="lg:col-span-3 flex flex-col h-[500px]">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" /> Guardian Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4 pb-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm border shadow-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chat.isPending && (
                   <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm border p-3 flex gap-1 items-center">
                      <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce delay-75" />
                      <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce delay-150" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t p-3 bg-card">
            <form onSubmit={handleChatSubmit} className="flex w-full gap-2">
              <Input 
                placeholder="Ask Guardian anything..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-background"
              />
              <Button type="submit" size="icon" disabled={!chatInput.trim() || chat.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
