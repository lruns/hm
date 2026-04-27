package ru.neyvan.hm.surprises;

/**
 * Created by AndyGo on 21.02.2018.
 */

public class GiftAndTrap extends Surprise {
    //types of surprise
    public static final int SUPER_LIFE = 1;
    public static final int SUPER_SCORE = 2;
    public static final int DEBUF_LIFE = 3;
    public static final int DEBUF_SCORE = 4;
    private int type;
    private int number;

    public GiftAndTrap(){super();}
    public GiftAndTrap(float maxTime, int type, int number) {
        super(maxTime);
        this.type = type;
        this.number = number;
    }


    public int getType() {
        return type;
    }

    public int getNumber() {
        return number;
    }
}
