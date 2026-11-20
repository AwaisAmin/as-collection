import { Module } from '@nestjs/common';

import { OrdersModule } from '../modules/orders/orders.module.js';
import { JobScheduler } from './job-scheduler.service.js';
import { MaintenanceJobs } from './maintenance.jobs.js';

/** Background maintenance (see `JOBS_ENABLED`). */
@Module({
  imports: [OrdersModule],
  providers: [JobScheduler, MaintenanceJobs],
  exports: [MaintenanceJobs, JobScheduler],
})
export class JobsModule {}
