package ru.neyvan.hm.terms;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class Divisibility extends Term {

    private int divider;

    public Divisibility(){super();}
    public Divisibility(int ID, int divider) {
        super(ID);
        this.divider = divider;

    }
    @Override
    public boolean checkCondition(int numberToCheck) {
        return numberToCheck % divider == 0;
    }

    public int getDivider() {
        return divider;
    }
}
