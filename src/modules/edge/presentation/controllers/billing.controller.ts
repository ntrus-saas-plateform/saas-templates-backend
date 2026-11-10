import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  ApproveInvoiceUseCase,
  ApproveRefundUseCase,
  CreateBillingAccountUseCase,
  CreateBillingScheduleUseCase,
  CreateDraftInvoiceFromSubscriptionUseCase,
  CreatePaymentIntentUseCase,
  ConfirmPaymentIntentUseCase,
  CreateRefundUseCase,
  GetBillingAccountUseCase,
  GetBillingAnalyticsUseCase,
  GetBillingOverviewUseCase,
  GetInvoiceUseCase,
  IssueInvoiceUseCase,
  LinkSubscriptionToBillingAccountUseCase,
  ListBillingAccountsUseCase,
  ListInvoicesUseCase,
  OpenCollectionCaseUseCase,
  PreviewInvoiceUseCase,
  ProcessPaymentWebhookUseCase,
  RecordDunningAttemptUseCase,
  UpsertBillingProfileUseCase,
  VoidInvoiceUseCase,
} from '../../application/billing/billing.use-cases.js';
import {
  ApplyTaxToInvoiceUseCase,
  ConvertAmountUseCase,
  CreateCreditNoteUseCase,
  CreateDisputeUseCase,
  CreateFxRateUseCase,
  CreateSettlementBatchUseCase,
  EscalateCollectionCaseUseCase,
  GetBillingProfileUseCase,
  GetCollectionCaseUseCase,
  IngestProviderTransactionUseCase,
  ListBillingPartiesUseCase,
  ListBillingPoliciesUseCase,
  ListBillingProfilesUseCase,
  ListBillingSchedulesUseCase,
  ListCollectionCasesUseCase,
  ListCreditNotesUseCase,
  ListDisputesUseCase,
  ListFxRatesUseCase,
  ListJournalEntriesUseCase,
  ListPaymentIntentsUseCase,
  ListPaymentMethodsUseCase,
  ListReconciliationExceptionsUseCase,
  ListReconciliationRunsUseCase,
  ListRefundsUseCase,
  ListSettlementBatchesUseCase,
  ListTaxJurisdictionsUseCase,
  RegisterPaymentMethodUseCase,
  ResolveCollectionCaseUseCase,
  ResolveDisputeUseCase,
  ResolveReconciliationExceptionUseCase,
  RevokePaymentMethodUseCase,
  RunReconciliationUseCase,
  UpsertBillingPartyUseCase,
  UpsertBillingPolicyUseCase,
} from '../../application/billing/billing-ops.use-cases.js';
import {
  GenerateFinancialExportUseCase,
  GetCustomerBillingPortalUseCase,
  GetFinancialExportUseCase,
  ListFinancialExportsUseCase,
  ListRevenuePoliciesUseCase,
  MarkOverdueInvoicesUseCase,
  ProcessDueBillingSchedulesUseCase,
  UpsertRevenuePolicyUseCase,
} from '../../application/billing/billing-lifecycle.use-cases.js';

@ApiTags('edge-billing')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/billing')
export class EdgeBillingController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly overview: GetBillingOverviewUseCase,
    private readonly analytics: GetBillingAnalyticsUseCase,
    private readonly createAccount: CreateBillingAccountUseCase,
    private readonly listAccountsUseCase: ListBillingAccountsUseCase,
    private readonly getAccount: GetBillingAccountUseCase,
    private readonly upsertProfile: UpsertBillingProfileUseCase,
    private readonly getProfile: GetBillingProfileUseCase,
    private readonly listProfiles: ListBillingProfilesUseCase,
    private readonly upsertParty: UpsertBillingPartyUseCase,
    private readonly listParties: ListBillingPartiesUseCase,
    private readonly linkSubscription: LinkSubscriptionToBillingAccountUseCase,
    private readonly createSchedule: CreateBillingScheduleUseCase,
    private readonly listSchedules: ListBillingSchedulesUseCase,
    private readonly previewInvoice: PreviewInvoiceUseCase,
    private readonly draftInvoice: CreateDraftInvoiceFromSubscriptionUseCase,
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly approveInvoice: ApproveInvoiceUseCase,
    private readonly issueInvoice: IssueInvoiceUseCase,
    private readonly voidInvoiceUseCase: VoidInvoiceUseCase,
    private readonly applyTax: ApplyTaxToInvoiceUseCase,
    private readonly listTaxJurisdictions: ListTaxJurisdictionsUseCase,
    private readonly createCreditNote: CreateCreditNoteUseCase,
    private readonly listCreditNotes: ListCreditNotesUseCase,
    private readonly createPaymentIntent: CreatePaymentIntentUseCase,
    private readonly confirmPayment: ConfirmPaymentIntentUseCase,
    private readonly listPaymentIntents: ListPaymentIntentsUseCase,
    private readonly createRefund: CreateRefundUseCase,
    private readonly approveRefund: ApproveRefundUseCase,
    private readonly listRefunds: ListRefundsUseCase,
    private readonly listPaymentMethods: ListPaymentMethodsUseCase,
    private readonly registerPaymentMethod: RegisterPaymentMethodUseCase,
    private readonly revokePaymentMethod: RevokePaymentMethodUseCase,
    private readonly openCollection: OpenCollectionCaseUseCase,
    private readonly listCollections: ListCollectionCasesUseCase,
    private readonly getCollection: GetCollectionCaseUseCase,
    private readonly escalateCollection: EscalateCollectionCaseUseCase,
    private readonly resolveCollection: ResolveCollectionCaseUseCase,
    private readonly recordDunning: RecordDunningAttemptUseCase,
    private readonly listPolicies: ListBillingPoliciesUseCase,
    private readonly upsertPolicy: UpsertBillingPolicyUseCase,
    private readonly runReconciliation: RunReconciliationUseCase,
    private readonly listReconRuns: ListReconciliationRunsUseCase,
    private readonly listReconExceptions: ListReconciliationExceptionsUseCase,
    private readonly resolveReconException: ResolveReconciliationExceptionUseCase,
    private readonly ingestProviderTxn: IngestProviderTransactionUseCase,
    private readonly createSettlement: CreateSettlementBatchUseCase,
    private readonly listSettlements: ListSettlementBatchesUseCase,
    private readonly createDispute: CreateDisputeUseCase,
    private readonly listDisputes: ListDisputesUseCase,
    private readonly resolveDispute: ResolveDisputeUseCase,
    private readonly listFx: ListFxRatesUseCase,
    private readonly createFx: CreateFxRateUseCase,
    private readonly convertAmount: ConvertAmountUseCase,
    private readonly listJournal: ListJournalEntriesUseCase,
    private readonly processDueSchedules: ProcessDueBillingSchedulesUseCase,
    private readonly markOverdueInvoices: MarkOverdueInvoicesUseCase,
    private readonly customerPortal: GetCustomerBillingPortalUseCase,
    private readonly generateExport: GenerateFinancialExportUseCase,
    private readonly listExports: ListFinancialExportsUseCase,
    private readonly getExport: GetFinancialExportUseCase,
    private readonly listRevenuePolicies: ListRevenuePoliciesUseCase,
    private readonly upsertRevenuePolicy: UpsertRevenuePolicyUseCase,
    private readonly processWebhook: ProcessPaymentWebhookUseCase,
  ) {}

  private actorId(): string {
    return this.edgeContext.getOrThrow().administratorId!;
  }

  @Get('overview')
  @RequireEdgePermissions('platform:billing:reports:read')
  getOverview() {
    return this.overview.execute();
  }

  @Get('analytics')
  @RequireEdgePermissions('platform:billing:reports:read')
  getAnalytics(@Query('currency') currency?: string) {
    return this.analytics.execute(currency);
  }

  @Get('accounts')
  @RequireEdgePermissions('platform:billing:accounts:read')
  listAccounts() {
    return this.listAccountsUseCase.execute();
  }

  @Get('accounts/:id')
  @RequireEdgePermissions('platform:billing:accounts:read')
  getAccountById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getAccount.execute(id);
  }

  @Post('accounts')
  @RequireEdgePermissions('platform:billing:accounts:create')
  createAccountHandler(
    @Body()
    body: { commercialAccountId: string; currency?: string; paymentTermsDays?: number },
  ) {
    return this.createAccount.execute({
      actorId: this.actorId(),
      commercialAccountId: body.commercialAccountId,
      currency: body.currency,
      paymentTermsDays: body.paymentTermsDays,
    });
  }

  @Post('accounts/:id/subscriptions')
  @RequireEdgePermissions('platform:billing:accounts:update')
  linkSubscriptionHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { subscriptionId: string },
  ) {
    return this.linkSubscription.execute({
      billingAccountId: id,
      subscriptionId: body.subscriptionId,
    });
  }

  @Get('accounts/:id/profiles')
  @RequireEdgePermissions('platform:billing:profiles:read')
  listAccountProfiles(@Param('id', ParseUUIDPipe) id: string) {
    return this.listProfiles.execute(id);
  }

  @Get('accounts/:id/profiles/current')
  @RequireEdgePermissions('platform:billing:profiles:read')
  getCurrentProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.getProfile.execute(id);
  }

  @Post('accounts/:id/profiles')
  @RequireEdgePermissions('platform:billing:profiles:manage')
  upsertAccountProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      legalName: string;
      tradeName?: string | null;
      country?: string | null;
      currency: string;
      paymentTermsDays: number;
      snapshot?: Record<string, unknown>;
    },
  ) {
    return this.upsertProfile.execute({ billingAccountId: id, ...body });
  }

  @Get('accounts/:id/parties')
  @RequireEdgePermissions('platform:billing:accounts:read')
  listAccountParties(@Param('id', ParseUUIDPipe) id: string) {
    return this.listParties.execute(id);
  }

  @Post('accounts/:id/parties')
  @RequireEdgePermissions('platform:billing:accounts:update')
  upsertAccountParty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      partyRole: string;
      legalName: string;
      taxId?: string | null;
      country?: string | null;
      address?: Record<string, unknown>;
      email?: string | null;
    },
  ) {
    return this.upsertParty.execute({ billingAccountId: id, ...body });
  }

  @Get('accounts/:id/payment-methods')
  @RequireEdgePermissions('platform:billing:payments:read')
  listAccountPaymentMethods(@Param('id', ParseUUIDPipe) id: string) {
    return this.listPaymentMethods.execute(id);
  }

  @Post('accounts/:id/payment-methods')
  @RequireEdgePermissions('platform:billing:payments:initiate')
  registerAccountPaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      provider: string;
      providerMethodRef: string;
      methodType: string;
      brand?: string | null;
      last4?: string | null;
      isDefault?: boolean;
    },
  ) {
    return this.registerPaymentMethod.execute({ billingAccountId: id, ...body });
  }

  @Delete('accounts/:id/payment-methods/:methodId')
  @RequireEdgePermissions('platform:billing:payments:cancel')
  revokeAccountPaymentMethod(@Param('methodId', ParseUUIDPipe) methodId: string) {
    return this.revokePaymentMethod.execute(methodId);
  }

  @Get('accounts/:id/journal')
  @RequireEdgePermissions('platform:billing:ledger:read')
  listAccountJournal(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.listJournal.execute(id, limit ? Number(limit) : undefined);
  }

  @Post('schedules')
  @RequireEdgePermissions('platform:billing:schedules:manage')
  createScheduleHandler(
    @Body()
    body: {
      subscriptionId: string;
      billingAccountId: string;
      frequency: string;
      nextBillAt?: string | null;
    },
  ) {
    return this.createSchedule.execute({
      ...body,
      nextBillAt: body.nextBillAt ? new Date(body.nextBillAt) : null,
    });
  }

  @Get('schedules')
  @RequireEdgePermissions('platform:billing:schedules:manage')
  listSchedulesHandler(@Query('subscriptionId', ParseUUIDPipe) subscriptionId: string) {
    return this.listSchedules.execute(subscriptionId);
  }

  @Post('invoices/preview')
  @RequireEdgePermissions('platform:billing:invoices:preview')
  preview(
    @Body()
    body: {
      currency: string;
      lines: {
        description: string;
        quantity: string | number;
        unitPrice: string;
        discountAmount?: string;
        taxAmount?: string;
      }[];
      taxLines?: { taxAmount: string }[];
      discountTotal?: string;
    },
  ) {
    return this.previewInvoice.execute(body);
  }

  @Get('invoices')
  @RequireEdgePermissions('platform:billing:invoices:read')
  listInvoices(
    @Query('billingAccountId') billingAccountId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listInvoicesUseCase.execute({
      billingAccountId,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('invoices/:id')
  @RequireEdgePermissions('platform:billing:invoices:read')
  getInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.getInvoiceUseCase.execute(id);
  }

  @Post('invoices/draft-from-subscription')
  @RequireEdgePermissions('platform:billing:invoices:create')
  draftFromSubscription(@Body() body: { subscriptionId: string; periodId?: string | null }) {
    return this.draftInvoice.execute({
      actorId: this.actorId(),
      subscriptionId: body.subscriptionId,
      periodId: body.periodId ?? null,
    });
  }

  @Post('invoices/:id/approve')
  @RequireEdgePermissions('platform:billing:invoices:approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.approveInvoice.execute({ actorId: this.actorId(), invoiceId: id });
  }

  @Post('invoices/:id/issue')
  @RequireEdgePermissions('platform:billing:invoices:issue')
  issue(@Param('id', ParseUUIDPipe) id: string) {
    return this.issueInvoice.execute({ actorId: this.actorId(), invoiceId: id });
  }

  @Post('invoices/:id/void')
  @RequireEdgePermissions('platform:billing:invoices:void')
  voidInvoiceHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    return this.voidInvoiceUseCase.execute({
      actorId: this.actorId(),
      invoiceId: id,
      reason: body.reason,
    });
  }

  @Post('invoices/:id/apply-tax')
  @RequireEdgePermissions('platform:billing:invoices:create')
  applyTaxHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { country?: string | null; category?: string },
  ) {
    return this.applyTax.execute({ invoiceId: id, ...body });
  }

  @Post('invoices/:id/credit-notes')
  @RequireEdgePermissions('platform:billing:invoices:void')
  createCreditNoteHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amount: string; reason: string },
  ) {
    return this.createCreditNote.execute({
      actorId: this.actorId(),
      invoiceId: id,
      amount: body.amount,
      reason: body.reason,
    });
  }

  @Get('credit-notes')
  @RequireEdgePermissions('platform:billing:invoices:read')
  listCreditNotesHandler(
    @Query('billingAccountId') billingAccountId?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.listCreditNotes.execute({ billingAccountId, invoiceId });
  }

  @Get('tax/jurisdictions')
  @RequireEdgePermissions('platform:billing:policies:manage')
  taxJurisdictions() {
    return this.listTaxJurisdictions.execute();
  }

  @Get('payments')
  @RequireEdgePermissions('platform:billing:payments:read')
  listPayments(
    @Query('billingAccountId') billingAccountId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listPaymentIntents.execute({
      billingAccountId,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('payments/intents')
  @RequireEdgePermissions('platform:billing:payments:initiate')
  createIntent(
    @Body()
    body: {
      billingAccountId: string;
      invoiceId?: string | null;
      amount: string;
      currency: string;
    },
  ) {
    return this.createPaymentIntent.execute({
      actorId: this.actorId(),
      ...body,
    });
  }

  @Post('payments/intents/:id/confirm')
  @RequireEdgePermissions('platform:billing:payments:confirm')
  confirmIntent(@Param('id', ParseUUIDPipe) id: string) {
    return this.confirmPayment.execute({
      actorId: this.actorId(),
      paymentIntentId: id,
    });
  }

  @Post('refunds')
  @RequireEdgePermissions('platform:billing:refunds:create')
  createRefundHandler(
    @Body()
    body: {
      paymentIntentId: string;
      amount: string;
      currency: string;
      reason?: string | null;
      invoiceId?: string | null;
    },
  ) {
    return this.createRefund.execute(body);
  }

  @Get('refunds')
  @RequireEdgePermissions('platform:billing:payments:read')
  listRefundsHandler(
    @Query('paymentIntentId') paymentIntentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listRefunds.execute({
      paymentIntentId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('refunds/:id/approve')
  @RequireEdgePermissions('platform:billing:refunds:approve')
  approveRefundHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { requesterId: string },
  ) {
    return this.approveRefund.execute({
      actorId: this.actorId(),
      refundId: id,
      requesterId: body.requesterId,
    });
  }

  @Get('collections')
  @RequireEdgePermissions('platform:billing:collections:manage')
  listCollectionsHandler(
    @Query('billingAccountId') billingAccountId?: string,
    @Query('status') status?: string,
  ) {
    return this.listCollections.execute({ billingAccountId, status });
  }

  @Get('collections/:id')
  @RequireEdgePermissions('platform:billing:collections:manage')
  getCollectionHandler(@Param('id', ParseUUIDPipe) id: string) {
    return this.getCollection.execute(id);
  }

  @Post('collections')
  @RequireEdgePermissions('platform:billing:collections:manage')
  openCollectionHandler(
    @Body() body: { billingAccountId: string; invoiceId: string },
  ) {
    return this.openCollection.execute({ actorId: this.actorId(), ...body });
  }

  @Post('collections/:id/escalate')
  @RequireEdgePermissions('platform:billing:collections:manage')
  escalateCollectionHandler(@Param('id', ParseUUIDPipe) id: string) {
    return this.escalateCollection.execute({ caseId: id });
  }

  @Post('collections/:id/resolve')
  @RequireEdgePermissions('platform:billing:collections:manage')
  resolveCollectionHandler(@Param('id', ParseUUIDPipe) id: string) {
    return this.resolveCollection.execute({ caseId: id });
  }

  @Post('collections/:id/dunning')
  @RequireEdgePermissions('platform:billing:collections:manage')
  recordDunningHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { channel: string; templateRef?: string | null },
  ) {
    return this.recordDunning.execute({ caseId: id, ...body });
  }

  @Get('policies')
  @RequireEdgePermissions('platform:billing:policies:manage')
  listPoliciesHandler(@Query('policyType') policyType?: string) {
    return this.listPolicies.execute(policyType);
  }

  @Post('policies')
  @RequireEdgePermissions('platform:billing:policies:manage')
  upsertPolicyHandler(
    @Body()
    body: {
      code: string;
      policyType: string;
      rules: Record<string, unknown>;
      status?: string;
    },
  ) {
    return this.upsertPolicy.execute(body);
  }

  @Post('reconciliation/runs')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  runReconciliationHandler(@Body() body: { provider: string }) {
    return this.runReconciliation.execute({
      provider: body.provider,
      actorId: this.actorId(),
    });
  }

  @Get('reconciliation/runs')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  listReconRunsHandler(@Query('limit') limit?: string) {
    return this.listReconRuns.execute(limit ? Number(limit) : undefined);
  }

  @Get('reconciliation/exceptions')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  listReconExceptionsHandler(
    @Query('runId') runId?: string,
    @Query('status') status?: string,
  ) {
    return this.listReconExceptions.execute({ runId, status });
  }

  @Post('reconciliation/exceptions/:id/resolve')
  @RequireEdgePermissions('platform:billing:reconciliation:resolve')
  resolveReconExceptionHandler(@Param('id', ParseUUIDPipe) id: string) {
    return this.resolveReconException.execute(id);
  }

  @Post('provider-transactions')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  ingestProviderTxnHandler(
    @Body()
    body: {
      provider: string;
      providerTxnId: string;
      paymentIntentId?: string | null;
      amount: string;
      currency: string;
      status?: string;
      fees?: string;
    },
  ) {
    return this.ingestProviderTxn.execute(body);
  }

  @Post('settlements')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  createSettlementHandler(
    @Body()
    body: {
      provider: string;
      merchantAccount?: string | null;
      settlementDate: string;
      grossAmount: string;
      fees?: string;
      refunds?: string;
      chargebacks?: string;
      netAmount: string;
      currency: string;
      bankReference?: string | null;
    },
  ) {
    return this.createSettlement.execute(body);
  }

  @Get('settlements')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  listSettlementsHandler(@Query('limit') limit?: string) {
    return this.listSettlements.execute(limit ? Number(limit) : undefined);
  }

  @Post('disputes')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  createDisputeHandler(
    @Body()
    body: {
      billingAccountId: string;
      paymentIntentId?: string | null;
      invoiceId?: string | null;
      provider: string;
      amount: string;
      currency: string;
      disputeType?: string;
      providerDisputeId?: string | null;
    },
  ) {
    return this.createDispute.execute(body);
  }

  @Get('disputes')
  @RequireEdgePermissions('platform:billing:reconciliation:execute')
  listDisputesHandler(
    @Query('billingAccountId') billingAccountId?: string,
    @Query('status') status?: string,
  ) {
    return this.listDisputes.execute({ billingAccountId, status });
  }

  @Patch('disputes/:id')
  @RequireEdgePermissions('platform:billing:reconciliation:resolve')
  resolveDisputeHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string; resolution?: Record<string, unknown> },
  ) {
    return this.resolveDispute.execute({
      disputeId: id,
      status: body.status,
      resolution: body.resolution,
    });
  }

  @Get('fx/rates')
  @RequireEdgePermissions('platform:billing:policies:manage')
  listFxHandler(@Query('baseCurrency') baseCurrency?: string) {
    return this.listFx.execute(baseCurrency);
  }

  @Post('fx/rates')
  @RequireEdgePermissions('platform:billing:policies:manage')
  createFxHandler(
    @Body()
    body: {
      baseCurrency: string;
      quoteCurrency: string;
      rate: string;
      source?: string;
    },
  ) {
    return this.createFx.execute(body);
  }

  @Post('fx/convert')
  @RequireEdgePermissions('platform:billing:reports:read')
  convertFxHandler(@Body() body: { amount: string; from: string; to: string }) {
    return this.convertAmount.execute(body);
  }

  @Post('schedules/process-due')
  @RequireEdgePermissions('platform:billing:schedules:manage')
  processDueSchedulesHandler() {
    return this.processDueSchedules.execute({ actorId: this.actorId() });
  }

  @Post('invoices/mark-overdue')
  @RequireEdgePermissions('platform:billing:invoices:issue')
  markOverdueHandler() {
    return this.markOverdueInvoices.execute({ actorId: this.actorId() });
  }

  @Get('portal/:billingAccountId')
  @RequireEdgePermissions('platform:billing:portal:read')
  customerPortalHandler(@Param('billingAccountId', ParseUUIDPipe) billingAccountId: string) {
    return this.customerPortal.execute(billingAccountId);
  }

  @Post('exports')
  @RequireEdgePermissions('platform:billing:exports:execute')
  generateExportHandler(
    @Body()
    body: {
      exportType?: string;
      currency?: string;
      periodStart?: string | null;
      periodEnd?: string | null;
    },
  ) {
    return this.generateExport.execute({
      actorId: this.actorId(),
      exportType: body.exportType,
      currency: body.currency,
      periodStart: body.periodStart ? new Date(body.periodStart) : null,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
    });
  }

  @Get('exports')
  @RequireEdgePermissions('platform:billing:exports:execute')
  listExportsHandler(@Query('limit') limit?: string) {
    return this.listExports.execute(limit ? Number(limit) : undefined);
  }

  @Get('exports/:id')
  @RequireEdgePermissions('platform:billing:exports:execute')
  getExportHandler(@Param('id', ParseUUIDPipe) id: string) {
    return this.getExport.execute(id);
  }

  @Get('revenue-policies')
  @RequireEdgePermissions('platform:billing:policies:manage')
  listRevenuePoliciesHandler() {
    return this.listRevenuePolicies.execute();
  }

  @Post('revenue-policies')
  @RequireEdgePermissions('platform:billing:policies:manage')
  upsertRevenuePolicyHandler(
    @Body()
    body: {
      code: string;
      method: string;
      rules?: Record<string, unknown>;
      status?: string;
    },
  ) {
    return this.upsertRevenuePolicy.execute(body);
  }

  @Post('webhooks/payments')
  processPaymentWebhook(
    @Body()
    body: {
      provider: string;
      providerEventId: string;
      signatureValid: boolean;
      payload: Record<string, unknown>;
      paymentIntentId?: string | null;
    },
  ) {
    return this.processWebhook.execute({
      actorId: 'system:payment-webhook',
      ...body,
    });
  }
}
