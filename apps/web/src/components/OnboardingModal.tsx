'use client'

import { useState, useEffect } from 'react'
import { X, ExternalLink, Key, CheckCircle, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface OnboardingModalProps {
  onClose: () => void
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const providers = [
    {
      name: 'Google AI Studio',
      logo: '/logos/gemini.png',
      description: '✨ FREE - Start chatting immediately with Gemini models',
      apiUrl: null,
      isFree: true,
      steps: [
        '🎉 Already enabled for you!',
        'No API key needed',
        'Just start chatting',
        'Powered by Google AI Studio free tier'
      ]
    },
    {
      name: 'OpenAI',
      logo: '/logos/gpt-icon.png',
      description: 'Access GPT-4, GPT-4o, and other models',
      apiUrl: 'https://platform.openai.com/api-keys',
      steps: [
        'Sign up or log in to OpenAI Platform',
        'Go to API Keys section',
        'Click "Create new secret key"',
        'Copy the key and paste it in Settings'
      ]
    },
    {
      name: 'Anthropic',
      logo: '/logos/anthropic.png',
      description: 'Access Claude 3.5 Sonnet and other models',
      apiUrl: 'https://console.anthropic.com/settings/keys',
      steps: [
        'Sign up or log in to Anthropic Console',
        'Navigate to API Keys section',
        'Click "Create Key"',
        'Copy the key and paste it in Settings'
      ]
    },
    {
      name: 'Google Gemini',
      logo: '/logos/gemini.png',
      description: 'Access Gemini 1.5 Pro and Flash models',
      apiUrl: 'https://aistudio.google.com/app/apikey',
      steps: [
        'Sign up or log in to Google AI Studio',
        'Click "Get API Key"',
        'Create or select a project',
        'Copy the key and paste it in Settings'
      ]
    },
    {
      name: 'OpenRouter',
      logo: '/logos/openrouter.png',
      description: 'Access 100+ models from various providers',
      apiUrl: 'https://openrouter.ai/keys',
      steps: [
        'Sign up or log in to OpenRouter',
        'Go to Keys page',
        'Click "Create Key"',
        'Copy the key and paste it in Settings'
      ]
    }
  ]

  const handleSkip = () => {
    localStorage.setItem('omnimind_onboarding_completed', 'true')
    onClose()
  }

  const handleGetStarted = () => {
    setCurrentStep(1)
  }

  const handleFinish = () => {
    localStorage.setItem('omnimind_onboarding_completed', 'true')
    onClose()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-accent rounded-lg transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            {currentStep === 0 ? (
              // Welcome Step
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-bold mb-2">Welcome to OmniMind! 🎉</h2>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-3">
                    Start chatting <strong className="text-green-600 dark:text-green-400">immediately for FREE</strong> with Google AI Studio, or add your own API keys for more providers.
                  </p>
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full font-semibold text-sm">
                    <Sparkles className="w-4 h-4" />
                    Google AI Studio is already enabled!
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 text-left max-w-xl mx-auto space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Why do I need API keys?
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span><strong>Privacy:</strong> Your API keys are stored locally and encrypted. We never see or store them on our servers.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span><strong>Direct Access:</strong> You communicate directly with AI providers, ensuring data privacy.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span><strong>Your Control:</strong> You manage your own usage and billing directly with providers.</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <button
                    onClick={handleGetStarted}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg shadow-lg"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-6 py-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    I&apos;ll do this later
                  </button>
                </div>
              </div>
            ) : (
              // API Keys Step
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-2">Get Your API Keys</h2>
                  <p className="text-muted-foreground">
                    Choose one or more providers to start chatting. You can always add more later.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {providers.map((provider, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-6 hover:shadow-md transition-all ${
                        provider.isFree 
                          ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {/* Provider Header */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                          <Image
                            src={provider.logo}
                            alt={`${provider.name} logo`}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{provider.name}</h3>
                            {provider.isFree && (
                              <span className="flex items-center gap-1 text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-0.5 rounded-full font-semibold">
                                <Sparkles className="w-3 h-3" />
                                FREE
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {provider.description}
                          </p>
                        </div>
                      </div>

                      {/* Steps */}
                      <div className="space-y-2 mb-4">
                        {provider.steps.map((step, stepIndex) => (
                          <div key={stepIndex} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-semibold mt-0.5 flex-shrink-0">
                              {stepIndex + 1}.
                            </span>
                            <span className="text-muted-foreground">{step}</span>
                          </div>
                        ))}
                      </div>

                      {/* Get API Key Button */}
                      {provider.isFree ? (
                        <div className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium">
                          <CheckCircle className="w-5 h-5" />
                          Ready to Use!
                        </div>
                      ) : (
                        <a
                          href={provider.apiUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        >
                          Get {provider.name} API Key
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col items-center gap-4 pt-6 border-t border-border">
                  <div className="text-center">
                    <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        You can start chatting right now with Google AI Studio (FREE)!
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      To add more providers, go to <strong>Settings</strong> and enter your API keys.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      💡 Tip: Multiple providers let you compare responses side-by-side.
                    </p>
                  </div>
                  <button
                    onClick={handleFinish}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold shadow-lg"
                  >
                    Got it, Let&apos;s Start!
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
