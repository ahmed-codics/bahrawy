import { Test, TestingModule } from '@nestjs/testing';
import { AdminAssessmentController } from './admin-assessment.controller';
import { AdminAssessmentService } from './admin-assessment.service';
import { AuthService } from '../auth/auth.service';
import { RbacService } from '../rbac/rbac.service';

describe('AdminAssessmentController', () => {
  let controller: AdminAssessmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAssessmentController],
      providers: [
        {
          provide: AdminAssessmentService,
          useValue: {},
        },
        {
          provide: AuthService,
          useValue: {
            validateSession: jest.fn(),
          },
        },
        {
          provide: RbacService,
          useValue: {
            hasPermission: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminAssessmentController>(
      AdminAssessmentController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
