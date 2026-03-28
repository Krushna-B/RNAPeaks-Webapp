"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlotGeneTab } from "@/components/tabs/PlotGeneTab"
import { PlotRegionTab } from "@/components/tabs/PlotRegionTab"
import { SplicingMapTab } from "@/components/tabs/SplicingMapTab"
import { SequenceMapTab } from "@/components/tabs/SequenceMapTab"

export default function Home() {
  return (
    <Tabs
      defaultValue="plot-gene"
      className="h-screen flex flex-col gap-0 bg-background"
    >
      <header className="shrink-0 border-b bg-card">
        <div className="flex items-center gap-6 h-14 px-6">
          <div className="shrink-0">
            <p className="text-sm font-semibold tracking-tight">RNAPeaks</p>
            <p className="text-xs text-muted-foreground leading-none mt-0.5">
              Peak visualization &amp; analysis
            </p>
          </div>

          <TabsList className="h-9">
            <TabsTrigger value="plot-gene">Plot Gene</TabsTrigger>
            <TabsTrigger value="plot-region">Plot Region</TabsTrigger>
            <TabsTrigger value="splicing-map">Splicing Map</TabsTrigger>
            <TabsTrigger value="sequence-map">Sequence Map</TabsTrigger>
          </TabsList>

          <a
            href="https://github.com/Krushna-B/RNAPeaks"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs →
          </a>
        </div>
      </header>

      <TabsContent value="plot-gene" className="flex-1 overflow-hidden mt-0">
        <PlotGeneTab />
      </TabsContent>
      <TabsContent value="plot-region" className="flex-1 overflow-hidden mt-0">
        <PlotRegionTab />
      </TabsContent>
      <TabsContent value="splicing-map" className="flex-1 overflow-hidden mt-0">
        <SplicingMapTab />
      </TabsContent>
      <TabsContent value="sequence-map" className="flex-1 overflow-hidden mt-0">
        <SequenceMapTab />
      </TabsContent>
    </Tabs>
  )
}
