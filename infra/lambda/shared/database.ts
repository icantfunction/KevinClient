// Stage 4 Lambda Database Factory Purpose
import {
  ActivitiesService,
  ClientsService,
  ExpenseReceiptScansService,
  ExpensesService,
  EquipmentService,
  GalleriesService,
  InquiriesService,
  InvoicesService,
  PaymentsService,
  PhotosService,
  ReportsService,
  SearchService,
  SpacesService,
  SessionsService,
  ShotListsService,
  SmartFileTemplatesService,
  SmartFilesService,
  StudioBookingsService,
  TasksService,
  TimeEntriesService,
  createDatabaseClient,
} from "@studio-os/database";

export const createStage3Services = () => {
  const database = createDatabaseClient();

  return {
    database,
    activitiesService: new ActivitiesService(database),
    clientsService: new ClientsService(database),
    expenseReceiptScansService: new ExpenseReceiptScansService(database),
    expensesService: new ExpensesService(database),
    galleriesService: new GalleriesService(database),
    inquiriesService: new InquiriesService(database),
    invoicesService: new InvoicesService(database),
    paymentsService: new PaymentsService(database),
    photosService: new PhotosService(database),
    reportsService: new ReportsService(database),
    searchService: new SearchService(database),
    sessionsService: new SessionsService(database),
    shotListsService: new ShotListsService(database),
    smartFileTemplatesService: new SmartFileTemplatesService(database),
    smartFilesService: new SmartFilesService(database),
    spacesService: new SpacesService(database),
    equipmentService: new EquipmentService(database),
    studioBookingsService: new StudioBookingsService(database),
    tasksService: new TasksService(database),
    timeEntriesService: new TimeEntriesService(database),
  };
};
