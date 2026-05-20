'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  Sparkles, 
  Zap, 
  MessageSquare, 
  FileImage, 
  BarChart3, 
  Lock,
  CheckCircle2,
  ArrowRight,
  Github
} from 'lucide-react'

export default function LandingPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  const features = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Multi-Model Comparison',
      description: 'Compare responses from GPT-4, Claude, Gemini, and more side-by-side in real-time.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'AI Prompt Optimizer',
      description: 'Automatically enhance your prompts for better, more precise AI responses.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <FileImage className="w-6 h-6" />,
      title: 'Multimodal Support',
      description: 'Upload images and files to chat with vision-capable AI models.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Real-Time Streaming',
      description: 'See AI responses as they\'re generated with live streaming support.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Token & Cost Tracking',
      description: 'Monitor token usage and estimated costs for each conversation in real-time.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'Privacy First',
      description: 'Your API keys are encrypted and stored locally. We never see your data.',
      color: 'from-indigo-500 to-purple-500'
    }
  ]

  const providers = [
    { name: 'OpenAI', logo: '/logos/gpt-icon.png', models: 'GPT-4, GPT-4o, GPT-3.5' },
    { name: 'Anthropic', logo: '/logos/anthropic.png', models: 'Claude 3.5 Sonnet, Opus' },
    { name: 'Google', logo: '/logos/gemini.png', models: 'Gemini 1.5 Pro, Flash' },
    { name: 'OpenRouter', logo: '/logos/openrouter.png', models: '100+ Models' }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-8"
          >
            {/* Logo and Brand */}
            <div className="flex items-center justify-center gap-3">
              <Image
                src="/logos/icons8-mind-100.png"
                alt="OmniMind Logo"
                width={64}
                height={64}
                className="rounded-lg"
              />
              <h1 className="text-5xl sm:text-7xl font-bold">
                Omni<span className="text-sky-400">Mind</span>
              </h1>
            </div>

            {/* Hero Text */}
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-5xl font-bold text-foreground max-w-4xl mx-auto leading-tight">
                Compare AI Models Like Never Before
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Chat with multiple AI models simultaneously. See how GPT-4, Claude, and Gemini respond to the same prompt side-by-side.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/auth/signup"
                className="group px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-semibold text-lg flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auth/login"
                className="px-8 py-4 border-2 border-border rounded-lg hover:bg-accent transition-colors font-semibold text-lg"
              >
                Sign In
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>Use Your Own API Keys</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>Privacy Focused</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to get the most out of AI models
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
                className="group relative p-6 bg-background border border-border rounded-xl hover:shadow-lg transition-all duration-300"
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300`} />
                
                <div className="relative space-y-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} p-2.5 text-white transform group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>

                  {/* Content */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Providers Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Supported AI Providers</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect with the most powerful AI models from leading providers
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {providers.map((provider, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="p-6 bg-background border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all text-center"
              >
                <div className="flex justify-center mb-3">
                  <div className={`relative ${
                    provider.name === 'Google' 
                      ? 'w-14 h-14 bg-white rounded-lg flex items-center justify-center overflow-hidden' 
                      : provider.name === 'OpenAI'
                      ? 'w-14 h-14 bg-white rounded-lg flex items-center justify-center'
                      : ''
                  }`}>
                    <Image
                      src={provider.logo}
                      alt={`${provider.name} logo`}
                      width={48}
                      height={48}
                      className={`object-contain ${provider.name === 'Google' ? 'scale-150 mix-blend-darken' : ''}`}
                    />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{provider.name}</h3>
                <p className="text-sm text-muted-foreground">{provider.models}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join now and experience the power of comparing AI models in real-time
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logos/icons8-mind-100.png"
              alt="OmniMind"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="font-semibold">OmniMind</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2025 OmniMind. All rights reserved.
          </div>
          <a
            href="https://github.com/imrajyavardhan12"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            imrajyavardhan12
          </a>
        </div>
      </footer>
    </div>
  )
}
