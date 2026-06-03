import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
}  from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { PromotionService } from '../services/promotion.service';
import {
  PromotionRuleDto,
  PromoteStudentDto,
  BulkPromoteDto,
  MigrateStudentDto,
  ApproveMigrationDto,
  GenerateIDCardDto,
  BulkGenerateIDCardsDto,
  IDCardTemplateDto,
  CreateAlumniDto,
  AlumniQueryDto,
  ApproveAdmissionDto,
  RejectAdmissionDto,
} from '../dto/promotion.dto';
import { PromotionPreviewDto } from '../dto/promotion-preview.dto';


@ApiTags('admissions-extended')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('admissions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  // ========== PROMOTION RULES ==========

  @Post('promotion-rules')
  @ApiOperation({ summary: 'Create/update promotion rule' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createPromotionRule(@Req() req: any, @Body() dto: PromotionRuleDto) {
    return this.promotionService.createPromotionRule(req.tenantId, dto, req.user.id);
  }

  @Get('promotion-rules/:sessionId')
  @ApiOperation({ summary: 'Get promotion rules for a session' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getPromotionRules(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.promotionService.getPromotionRules(req.tenantId, sessionId);
  }

  @Post('promotion-rules/generate/:sessionId')
@ApiOperation({ summary: 'Auto generate promotion rules' })
@Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
async generatePromotionRules(
  @Req() req: any,
  @Param('sessionId') sessionId: string,
) {
  return this.promotionService.generatePromotionRules(
    req.tenantId,
    sessionId,
    req.user.id,
  );
}

@Post('promotion-preview')
@ApiOperation({ summary: 'Preview academic promotion' })
@Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
async promotionPreview(
  @Req() req: any,
  @Body() dto: PromotionPreviewDto,
) {
  return this.promotionService.promotionPreview(
    req.tenantId,
    dto,
  );
}

  // ========== STUDENT PROMOTION ==========

  @Post('promote')
  @ApiOperation({ summary: 'Promote a single student' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async promoteStudent(@Req() req: any, @Body() dto: PromoteStudentDto) {
    return this.promotionService.promoteStudent(req.tenantId, dto, req.user.id);
  }

  @Post('promote/bulk')
  @ApiOperation({ summary: 'Bulk promote students with filters' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async bulkPromote(@Req() req: any, @Body() dto: BulkPromoteDto) {
    return this.promotionService.bulkPromote(req.tenantId, dto, req.user.id);
  }

  @Get('promotion-history')
  @ApiOperation({ summary: 'Get promotion history' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getPromotionHistory(@Req() req: any, @Query('studentId') studentId?: string) {
    return this.promotionService.getPromotionHistory(req.tenantId, studentId);
  }

  // ========== STUDENT MIGRATION ==========

  @Post('migration')
  @ApiOperation({ summary: 'Create migration request' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createMigration(@Req() req: any, @Body() dto: MigrateStudentDto) {
    return this.promotionService.createMigrationRequest(req.tenantId, dto, req.user.id);
  }

  @Post('migration/:id/approve')
  @ApiOperation({ summary: 'Approve migration and generate TC' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async approveMigration(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveMigrationDto,
  ) {
    return this.promotionService.approveMigration(req.tenantId, id, dto, req.user.id);
  }

  @Get('migrations')
  @ApiOperation({ summary: 'Get migration requests' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getMigrations(@Req() req: any, @Query('status') status?: string) {
    return this.promotionService.getMigrationRequests(req.tenantId, status);
  }

  // ========== ID CARDS ==========

  @Post('id-cards')
  @ApiOperation({ summary: 'Generate ID card' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async generateIDCard(@Req() req: any, @Body() dto: GenerateIDCardDto) {
    return this.promotionService.generateIDCard(req.tenantId, dto, req.user.id);
  }

  @Post('id-cards/bulk')
  @ApiOperation({ summary: 'Bulk generate ID cards' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async bulkGenerateIDCards(@Req() req: any, @Body() dto: BulkGenerateIDCardsDto) {
    return this.promotionService.bulkGenerateIDCards(req.tenantId, dto, req.user.id);
  }

  @Get('id-cards/:id')
  @ApiOperation({ summary: 'Get ID card details' })
  async getIDCard(@Req() req: any, @Param('id') id: string) {
    return this.promotionService.getIDCard(req.tenantId, id);
  }

  @Get('id-cards/entity/:type/:entityId')
  @ApiOperation({ summary: 'Get ID card by entity' })
  async getIDCardByEntity(
    @Req() req: any,
    @Param('type') type: string,
    @Param('entityId') entityId: string,
  ) {
    return this.promotionService.getIDCardByEntity(req.tenantId, type, entityId);
  }

  @Post('id-cards/verify')
  @ApiOperation({ summary: 'Verify ID card by QR code' })
  async verifyIDCard(@Body('qrCode') qrCode: string) {
    return this.promotionService.verifyIDCard(qrCode);
  }

  // ========== ID CARD TEMPLATES ==========

  @Post('id-card-templates')
  @ApiOperation({ summary: 'Create ID card template' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async createIDCardTemplate(@Req() req: any, @Body() dto: IDCardTemplateDto) {
    return this.promotionService.createIDCardTemplate(req.tenantId, dto, req.user.id);
  }

  @Get('id-card-templates')
  @ApiOperation({ summary: 'Get ID card templates' })
  async getIDCardTemplates(@Req() req: any, @Query('type') type?: string) {
    return this.promotionService.getIDCardTemplates(req.tenantId, type);
  }

  // ========== ALUMNI ==========

  @Post('alumni')
  @ApiOperation({ summary: 'Create alumni record' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createAlumni(@Req() req: any, @Body() dto: CreateAlumniDto) {
    return this.promotionService.createAlumni(req.tenantId, dto);
  }

  @Get('alumni')
  @ApiOperation({ summary: 'Get alumni list' })
  async getAlumni(@Req() req: any, @Query() query: AlumniQueryDto) {
    return this.promotionService.getAlumni(req.tenantId, query);
  }

  @Get('alumni/:id')
  @ApiOperation({ summary: 'Get alumni details' })
  async getAlumniById(@Req() req: any, @Param('id') id: string) {
    return this.promotionService.getAlumniById(req.tenantId, id);
  }

  @Post('alumni/:id/verify')
  @ApiOperation({ summary: 'Verify alumni' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async verifyAlumni(@Req() req: any, @Param('id') id: string) {
    return this.promotionService.verifyAlumni(req.tenantId, id, req.user.id);
  }

  // ========== ADMISSION APPROVAL ==========

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve admission and create student' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async approveAdmission(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveAdmissionDto,
  ) {
    return this.promotionService.approveAdmission(req.tenantId, id, dto, req.user.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject admission' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async rejectAdmission(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RejectAdmissionDto,
  ) {
    return this.promotionService.rejectAdmission(req.tenantId, id, dto, req.user.id);
  }






}
