export function createPlayback(options: Record<string, any>): {
  newItem(type: string): Record<string, any>;
  newSlide(): Record<string, any>;
  ItemCreate: Record<string, (data: Record<string, any>) => any>;
  addSlide(data: Record<string, any>, index: number): void;
  generateMarkup(preview: boolean): string;
  generateJS(): string;
  getData(): Record<string, any>;
  getPreviewImageFun2(file: Record<string, any>, data: Record<string, any>): { previewImage: string };
};
