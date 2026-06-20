import { Controller, Get } from '@nestjs/common';
import { TestsService } from './tests.service';

/** Unauthenticated guest surface. No guards: anyone can read these.
 * Returns published-test metadata (locked teasers) and one full sample test. */
@Controller('public/tests')
export class PublicTestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  list() {
    return this.testsService.listPublishedPublic();
  }

  @Get('sample')
  sample() {
    return this.testsService.getSamplePublic();
  }
}
