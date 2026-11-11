import type { ModuleDefinition, SectionDefinition } from "@/core/modules/types";
import { materialsModule } from "@/features/materials/module";
// generator:imports:start
import {
  administrationModule,
  authoritiesModule,
  adminPanelModule,
  adminRolesModule,
  adminDepartmentsModule,
  adminAuditModule,
} from "@/features/administration/module";
import {
  modelCatalogModule,
  modelsModule,
} from "@/features/model-catalog/module";
import { bomModule } from "@/features/bom/module";
import { fpaModule } from "@/features/fpa/module";
import {
  materialLedgerModule,
  materialExitsModule,
  materialReturnsModule,
  currentInventoryModule,
} from "@/features/material-ledger/module";
import {
  invoicingModule,
  shippingInvoicesModule,
  valuationModule,
  purchasesModule,
} from "@/features/invoicing/module";
import {
  materialAreasModule,
  micomMaterialsModule,
  imdMaterialsModule,
  assyMaterialsModule,
  ipmMaterialsModule,
} from "@/features/material-areas/module";
import {
  productionPlanningModule,
  partPlanningModule,
  productionProjectionModule,
  projectedPlanModule,
  workOrdersModule,
} from "@/features/production-planning/module";
import { reworkModule } from "@/features/rework/module";
import {
  processProductionModule,
  imtProductionModule,
  smtProductionModule,
  processOperationsModule,
  lineOutputsModule,
} from "@/features/process-production/module";
import {
  shippingWarehouseModule,
  shippingExitsModule,
  shippingReturnsModule,
  shippingMovementsModule,
  shippingInventoryModule,
  shippingCatalogModule,
  shippingQaModule,
} from "@/features/shipping-warehouse/module";
import { scrapControlModule } from "@/features/scrap-control/module";
import {
  qualityControlModule,
  qualitySmtModule,
  qualityImdModule,
  qualityAssyModule,
  qualityPasteModule,
  qualityMaskModule,
  qualitySqueegeeModule,
  qualityInterlockModule,
  qualityLqcReleaseModule,
  qualityOqcReleaseModule,
  qualityLqcPpmModule,
  qualityOqcPpmModule,
} from "@/features/quality-control/module";
import {
  productionResultsModule,
  resultsRepairSmdModule,
  resultsRepairAssyModule,
  resultsExcessModule,
  resultsExcessEntriesModule,
  resultsExcessExitsModule,
  resultsInputSmtModule,
  resultsInputImdModule,
  resultsInputAssyModule,
  resultsDisplayModule,
  resultsMachineOperatorsModule,
  resultsMachineIctModule,
  resultsMachineIctPassModule,
  resultsMachineFctModule,
  resultsMachineFctPassModule,
  resultsMachineChangesModule,
  resultsMachineVisionModule,
  resultsMachineVisionPassModule,
  resultsMachineElectricalModule,
} from "@/features/production-results/module";
import {
  productTrackingModule,
  pcbTraceabilityModule,
} from "@/features/product-tracking/module";
// generator:imports:end

/** Register a feature once. Routes and both navigation levels read this list. */
export const modules: readonly ModuleDefinition[] = [
  materialsModule,
  // generator:modules:start
  administrationModule,
  authoritiesModule,
  modelCatalogModule,
  modelsModule,
  bomModule,
  fpaModule,
  materialLedgerModule,
  materialExitsModule,
  materialReturnsModule,
  currentInventoryModule,
  invoicingModule,
  shippingInvoicesModule,
  valuationModule,
  purchasesModule,
  materialAreasModule,
  micomMaterialsModule,
  imdMaterialsModule,
  assyMaterialsModule,
  ipmMaterialsModule,
  productionPlanningModule,
  partPlanningModule,
  productionProjectionModule,
  projectedPlanModule,
  workOrdersModule,
  reworkModule,
  processProductionModule,
  imtProductionModule,
  smtProductionModule,
  processOperationsModule,
  lineOutputsModule,
  shippingWarehouseModule,
  shippingExitsModule,
  shippingReturnsModule,
  shippingMovementsModule,
  shippingInventoryModule,
  shippingCatalogModule,
  shippingQaModule,
  scrapControlModule,
  qualityControlModule,
  qualitySmtModule,
  qualityImdModule,
  qualityAssyModule,
  qualityPasteModule,
  qualityMaskModule,
  qualitySqueegeeModule,
  qualityInterlockModule,
  qualityLqcReleaseModule,
  qualityOqcReleaseModule,
  qualityLqcPpmModule,
  qualityOqcPpmModule,
  productionResultsModule,
  resultsRepairSmdModule,
  resultsRepairAssyModule,
  resultsExcessModule,
  resultsExcessEntriesModule,
  resultsExcessExitsModule,
  resultsInputSmtModule,
  resultsInputImdModule,
  resultsInputAssyModule,
  resultsDisplayModule,
  resultsMachineOperatorsModule,
  resultsMachineIctModule,
  resultsMachineIctPassModule,
  resultsMachineFctModule,
  resultsMachineFctPassModule,
  resultsMachineChangesModule,
  resultsMachineVisionModule,
  resultsMachineVisionPassModule,
  resultsMachineElectricalModule,
  productTrackingModule,
  pcbTraceabilityModule,
  adminPanelModule,
  adminRolesModule,
  adminDepartmentsModule,
  adminAuditModule,
  // generator:modules:end
];
export const sections: readonly SectionDefinition[] = [
  { id: "informacion-basica", title: "Información básica", image: "info" },
  { id: "material", title: "Control de material", image: "material" },
  { id: "produccion", title: "Control de producción", image: "produccion" },
  { id: "proceso", title: "Control de proceso", image: "proceso" },
  { id: "calidad", title: "Control de calidad", image: "calidad" },
  { id: "resultados", title: "Control de resultados", image: "resultados" },
  { id: "reporte", title: "Control de reporte", image: "reporte" },
  {
    id: "configuracion",
    title: "Configuración de programa",
    image: "configuracion",
  },
  {
    id: "administracion",
    title: "Panel de Administración",
    image: "administracion",
  },
];
