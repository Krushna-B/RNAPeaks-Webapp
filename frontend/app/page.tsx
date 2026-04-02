"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlotGeneTab } from "@/components/tabs/PlotGeneTab"
import { PlotRegionTab } from "@/components/tabs/PlotRegionTab"
import { SplicingMapTab } from "@/components/tabs/SplicingMapTab"
import { SequenceMapTab } from "@/components/tabs/SequenceMapTab"
import { ThemeToggle } from "@/components/theme-provider"
import { BookOpen } from "lucide-react"

export default function Home() {
  return (
    <Tabs
      defaultValue="plot-gene"
      className="h-screen flex flex-col gap-0 bg-background"
    >
      <header className="shrink-0 border-b bg-card/95 backdrop-blur-sm">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-14 px-5 gap-4">
          {/* Left: branding */}
          <div className="flex items-center">
            <span className="text-lg font-semibold tracking-tight">RNAPeaks</span>
          </div>

          {/* Center: tabs */}
          <TabsList className="h-9">
            <TabsTrigger value="plot-gene">Plot Gene</TabsTrigger>
            <TabsTrigger value="plot-region">Plot Region</TabsTrigger>
            <TabsTrigger value="splicing-map">Splicing Map</TabsTrigger>
            <TabsTrigger value="sequence-map">Sequence Map</TabsTrigger>
          </TabsList>

          {/* Right: docs + theme toggle */}
          <div className="flex items-center justify-end gap-1">
            <a
              href="https://github.com/Krushna-B/RNAPeaks"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-3 h-8 text-xs font-medium text-muted-foreground border border-transparent transition-colors hover:border-border hover:bg-accent hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Documentation
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <TabsContent value="plot-gene" className="flex-1 min-h-0 overflow-hidden mt-0">
        <PlotGeneTab />
      </TabsContent>
      <TabsContent value="plot-region" className="flex-1 min-h-0 overflow-hidden mt-0">
        <PlotRegionTab />
      </TabsContent>
      <TabsContent value="splicing-map" className="flex-1 min-h-0 overflow-hidden mt-0">
        <SplicingMapTab />
      </TabsContent>
      <TabsContent value="sequence-map" className="flex-1 min-h-0 overflow-hidden mt-0">
        <SequenceMapTab />
      </TabsContent>
    </Tabs>
  )
}
