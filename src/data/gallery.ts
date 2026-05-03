export type GalleryItem = {
  id: string;
  type: "image" | "video";
  title: string;
  src: string;
  alt?: string;
  poster?: string;
};

export const galleryItems: GalleryItem[] = [
  {
    id: "studio-1",
    type: "image",
    title: "Main studio daylight",
    src: "/media/space-1.svg",
    alt: "Main studio with natural light",
  },
  {
    id: "studio-2",
    type: "image",
    title: "Backdrop wall",
    src: "/media/space-2.svg",
    alt: "Backdrop wall with seamless paper",
  },
  {
    id: "studio-3",
    type: "image",
    title: "Event layout",
    src: "/media/space-3.svg",
    alt: "Event layout with seated dining",
  },
  {
    id: "studio-4",
    type: "image",
    title: "Prep lounge",
    src: "/media/space-4.svg",
    alt: "Prep lounge and styling area",
  },
  {
    id: "studio-5",
    type: "image",
    title: "Podcast corner",
    src: "/media/space-5.svg",
    alt: "Podcast setup area",
  },
  {
    id: "video-1",
    type: "video",
    title: "Studio walkthrough clip",
    src: "",
    poster: "/media/video-1.svg",
  },
  {
    id: "video-2",
    type: "video",
    title: "Event setup timelapse",
    src: "",
    poster: "/media/video-2.svg",
  },
  {
    id: "video-3",
    type: "video",
    title: "Lighting demo",
    src: "",
    poster: "/media/video-3.svg",
  },
];
