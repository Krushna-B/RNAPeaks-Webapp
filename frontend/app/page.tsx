"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlotGeneTab } from "@/components/tabs/PlotGeneTab"
import { PlotRegionTab } from "@/components/tabs/PlotRegionTab"
import { SplicingMapTab } from "@/components/tabs/SplicingMapTab"
import { SequenceMapTab } from "@/components/tabs/SequenceMapTab"
import { RISplicingMapTab } from "@/components/tabs/RISplicingMapTab"
import { RISequenceMapTab } from "@/components/tabs/RISequenceMapTab"
import { ThemeToggle } from "@/components/theme-provider"
import { BookOpen } from "lucide-react"

export default function Home() {
  return (
    <Tabs
      defaultValue="plot-gene"
      className="flex h-screen flex-col gap-0 bg-background"
    >
      <header className="shrink-0 border-b bg-card/95 backdrop-blur-sm">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
          {/* Left: branding */}
          <div className="flex items-center">
            <span className="text-lg font-semibold tracking-tight">
              RNAPeaks
            </span>
          </div>

          {/* Center: tabs */}
          <TabsList className="h-9">
            <TabsTrigger value="plot-gene">Plot Gene</TabsTrigger>
            <TabsTrigger value="plot-region">Plot Region</TabsTrigger>
            <TabsTrigger value="splicing-map">Splicing Map</TabsTrigger>
            <TabsTrigger value="sequence-map">Sequence Map</TabsTrigger>
            <TabsTrigger value="ri-splicing-map">RI Splicing Map</TabsTrigger>
            <TabsTrigger value="ri-sequence-map">RI Sequence Map</TabsTrigger>
          </TabsList>

          {/* Right: docs + theme toggle */}
          <div className="flex items-center justify-end gap-1">
            <a
              href="https://krushna-b.github.io/RNAPeaks/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Documentation
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <TabsContent
        value="plot-gene"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <PlotGeneTab />
      </TabsContent>
      <TabsContent
        value="plot-region"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <PlotRegionTab />
      </TabsContent>
      <TabsContent
        value="splicing-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <SplicingMapTab />
      </TabsContent>
      <TabsContent
        value="sequence-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <SequenceMapTab />
      </TabsContent>
      <TabsContent
        value="ri-splicing-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <RISplicingMapTab />
      </TabsContent>
      <TabsContent
        value="ri-sequence-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <RISequenceMapTab />
      </TabsContent>
    </Tabs>
  )
}
