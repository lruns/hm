package ru.neyvan.hm.game;

/**
 * Created by AndyGo on 20.11.2017.
 */

public class Episodes {
    public static final int MAX_EPISODES = 5;
    private int[] levelsSize = {3,3,3,4,4,4,5,5,5,6};
    private String[] difficults = {"very easy", "easy", "easy", "normal", "normal", "normal", "normal", "hard", "hard", "very hard"};
    private boolean[] opened = {true, true, true, false, false, false, false, false, false, false};
    private boolean[] passed = {true, false, false, false, false, false, false, false, false, false};
    private int clickedEpisode;

    public int getClickedEpisode() {
        return clickedEpisode;
    }
    public void setClickedEpisode(int clickedEpisode){
        this.clickedEpisode = clickedEpisode;
    }

    public int getLevelsSize() {
        if(levelsSize.length <= clickedEpisode || clickedEpisode < 0) return -1;
        return levelsSize[clickedEpisode];
    }
    public String getDifficult() {
        if(difficults.length <= clickedEpisode || clickedEpisode < 0) return "not exist episode "+clickedEpisode;
        return difficults[clickedEpisode];
    }
    public boolean isOpened() {
        if(opened.length <= clickedEpisode || clickedEpisode < 0) return false;
        return opened[clickedEpisode];
    }
    public boolean isOpened(int numEpisode) {
        if(opened.length <= numEpisode || numEpisode < 0) return false;
        return opened[numEpisode];
    }
    public boolean isPassed(int numEpisode) {
        if(passed.length <= numEpisode || numEpisode < 0) return false;
        return passed[numEpisode];
    }

}
