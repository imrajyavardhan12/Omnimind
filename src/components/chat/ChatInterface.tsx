"use client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Brain, Link, Folder, Mic, Send } from "lucide-react"
import { LazyLiquidMetal, LazyPulsingBorder } from "@/components/ui/LazyShaders"
import { motion } from "framer-motion"
import { useState } from "react"
import { useSettingsStore } from "@/lib/stores/settings"
import { useModelTabsStore } from "@/lib/stores/modelTabs"
import { SimplePromptEnhancer } from "./SimplePromptEnhancer"
import { logger } from "@/lib/utils/logger"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function ChatInterface() {
  const [isFocused, setIsFocused] = useState(false)
  const [input, setInput] = useState('')
  const { providers } = useSettingsStore()
  const { selectedModels, addModel, getAllAvailableModels } = useModelTabsStore()
  
  // Get available models for the selector
  const availableModels = getAllAvailableModels()
  const enabledProviders = Object.entries(providers)
    .filter(([_, config]) => config.enabled)
    .map(([name, _]) => name)
  
  // Filter models to only show those from enabled providers
  const enabledModels = availableModels.filter(model => 
    enabledProviders.includes(model.provider)
  )

  const handleSend = () => {
    if (!input.trim()) return
    
    // If no models selected, add the first available one
    if (selectedModels.length === 0 && enabledModels.length > 0) {
      addModel(enabledModels[0])
    }
    
    // This will use your existing chat functionality
    // For now, just clear the input
    setInput('')
    logger.debug('Sending message:', input)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl relative">
        <div className="flex flex-row items-center mb-2">
          {/* Shader Circle */}
          <motion.div
            id="circle-ball"
            className="relative flex items-center justify-center z-10"
            animate={{
              y: isFocused ? 50 : 0,
              opacity: isFocused ? 0 : 100,
              filter: isFocused ? "blur(4px)" : "blur(0px)",
              rotate: isFocused ? 180 : 0,
            }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
          >
            <div className="z-10 absolute bg-white/5 h-11 w-11 rounded-full backdrop-blur-[3px]">
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-4 left-4  blur-[1px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-3 left-7  blur-[0.8px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-8 left-2  blur-[1px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-5 left-9 blur-[0.8px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-7 left-7  blur-[1px]" />
            </div>
            <LazyLiquidMetal
              style={{ height: 80, width: 80, filter: "blur(14px)", position: "absolute" }}
              colorBack="hsl(0, 0%, 0%, 0)"
              colorTint="hsl(29, 77%, 49%)"
              repetition={4}
              softness={0.5}
              shiftRed={0.3}
              shiftBlue={0.3}
              distortion={0.1}
              contour={1}
              shape="circle"
              offsetX={0}
              offsetY={0}
              scale={0.58}
              rotation={50}
              speed={5}
            />
            <LazyLiquidMetal
              style={{ height: 80, width: 80 }}
              colorBack="hsl(0, 0%, 0%, 0)"
              colorTint="hsl(29, 77%, 49%)"
              repetition={4}
              softness={0.5}
              shiftRed={0.3}
              shiftBlue={0.3}
              distortion={0.1}
              contour={1}
              shape="circle"
              offsetX={0}
              offsetY={0}
              scale={0.58}
              rotation={50}
              speed={5}
            />
          </motion.div>

          {/* Greeting Text - Fixed ESLint apostrophe */}
          <motion.p
            className="text-white/40 text-sm font-light z-10"
            animate={{
              y: isFocused ? 50 : 0,
              opacity: isFocused ? 0 : 100,
              filter: isFocused ? "blur(4px)" : "blur(0px)",
            }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
          >
            Hey there! I&apos;m here to help with anything you need
          </motion.p>
        </div>

        <div className="relative">
          <motion.div
            className="absolute w-full h-full z-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{
              duration: 0.8, 
            }}
          >
            <LazyPulsingBorder
              style={{ height: "146.5%", minWidth: "143%" }}
              colorBack="hsl(0, 0%, 0%)"
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.3}
              bloom={2}
              spots={2}
              spotSize={0.25}
              pulse={0}
              smoke={0.35}
              smokeSize={0.4}
              scale={0.7}
              rotation={0}
              offsetX={0}
              offsetY={0}
              speed={1}
              colors={[
                "hsl(29, 70%, 37%)",
                "hsl(32, 100%, 83%)",
                "hsl(4, 32%, 30%)",
                "hsl(25, 60%, 50%)",
                "hsl(0, 100%, 10%)",
              ]}
            />
          </motion.div>

          <motion.div
            className="relative bg-[#040404] rounded-2xl p-4 z-10"
            animate={{
              borderColor: isFocused ? "#BA9465" : "#3D3D3D",
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
            }}
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            {/* Message Input */}
            <div className="relative mb-6">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={enabledModels.length > 0 ? "Type your message here..." : "Configure API keys in Settings to start chatting..."}
                disabled={enabledModels.length === 0}
                className="min-h-[80px] resize-none bg-transparent border-none text-white text-base placeholder:text-zinc-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&:focus]:ring-0 [&:focus]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:outline-none disabled:opacity-50"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              
              {/* Send Button */}
              {input.trim() && (
                <Button
                  onClick={handleSend}
                  size="sm"
                  className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Prompt Enhancement */}
            {input.trim().length > 10 && enabledModels.length > 0 && (
              <div className="mb-4 flex justify-center">
                <SimplePromptEnhancer
                  originalPrompt={input}
                  onEnhancedSelect={(enhanced) => setInput(enhanced)}
                  preferredProvider={enabledModels[0]?.provider}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Left side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white p-0"
                >
                  <Brain className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Link className="h-4 w-4" />
                </Button>
                {/* Center model selector */}
                <div className="flex items-center">
                  <Select 
                    value={selectedModels[0]?.model.id || ''}
                    onValueChange={(value) => {
                      const model = enabledModels.find(m => m.id === value)
                      if (model && selectedModels.length === 0) {
                        addModel(model)
                      }
                    }}
                  >
                    <SelectTrigger className="bg-zinc-900 border-[#3D3D3D] text-white hover:bg-zinc-700 text-xs rounded-full px-2 h-8 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">⚡</span>
                        <SelectValue placeholder="Select model..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 z-30 border-[#3D3D3D] rounded-xl z-30">
                      {enabledModels.length > 0 ? (
                        enabledModels.map(model => (
                          <SelectItem key={model.id} value={model.id} className="text-white hover:bg-zinc-700 rounded-lg">
                            {model.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-models" disabled className="text-zinc-500 rounded-lg">
                          Configure API keys first
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Folder className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-orange-200 hover:bg-orange-300 text-orange-800 p-0"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}