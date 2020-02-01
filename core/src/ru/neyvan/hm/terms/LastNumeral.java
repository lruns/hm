package ru.neyvan.hm.terms;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class LastNumeral extends Term {
    private int numberPosition; // 0 - ones, 1 - tens, 2 - hundreds
    private int lastNumeral;
    private int power;
    public LastNumeral(int ID, int numberPosition, int lastNumeral) {
        super(ID);
        this.numberPosition = numberPosition;
        this.lastNumeral = lastNumeral;
        power = (int) Math.pow(10,numberPosition);
    }

    @Override
    public boolean checkCondition(int numberToCheck) {
        if(power > numberToCheck)return false;
        return (numberToCheck / power) % 10 == lastNumeral;

    }

    public int getNumberPosition() {
        return numberPosition;
    }

    public int getLastNumeral() {
        return lastNumeral;
    }
}
