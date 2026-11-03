import React, { useCallback } from 'react';
import { CanvasImage, GridType, ActiveGridType, ThreeDObject, ProjectOverlay } from '../types';
import { PaletteColor } from '../utils/westwoodTmpParser';
import { LatOption, getLatFolderForGrid, loadLatsIntoImages } from '../services/latsService';

interface UseLatHandlerProps {
    gridType: GridType;
    lastActiveGrid?: ActiveGridType;
    activePalette: PaletteColor[] | null;
    images: CanvasImage[];
    threeDObjects: ThreeDObject[];
    overlays: ProjectOverlay[];
    nextId: React.MutableRefObject<number>;
    setImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>;
    setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setHeldImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>;
    pushToHistory: (imgs: CanvasImage[], threed: ThreeDObject[], ovls: ProjectOverlay[]) => void;
    handleClearCanvas: () => void;
    setIsLoading: (msg: string | null) => void;
    setError: (msg: string | null) => void;
}

export function useLatHandler({
    gridType,
    lastActiveGrid,
    activePalette,
    images,
    threeDObjects,
    overlays,
    nextId,
    setImages,
    setSelectedImageIds,
    setHeldImages,
    pushToHistory,
    handleClearCanvas,
    setIsLoading,
    setError,
}: UseLatHandlerProps) {
    const handleSelectLatOption = useCallback(async (option: LatOption) => {
        setIsLoading('Loading LATS...');
        try {
            const folder = getLatFolderForGrid(gridType, lastActiveGrid);
            const newImages = await loadLatsIntoImages(
                folder,
                option,
                activePalette,
                () => nextId.current++,
                0,
                0
            );

            if (newImages.length > 0) {
                setHeldImages(newImages);
                setSelectedImageIds(new Set());
            }
        } catch (err: any) {
            console.error('Failed loading LATS:', err);
            setError(`Failed loading LATS: ${err.message}`);
        } finally {
            setIsLoading(null);
        }
    }, [
        gridType,
        lastActiveGrid,
        activePalette,
        images,
        threeDObjects,
        overlays,
        nextId,
        setImages,
        setSelectedImageIds,
        setHeldImages,
        pushToHistory,
        handleClearCanvas,
        setIsLoading,
        setError,
    ]);

    return { handleSelectLatOption };
}
